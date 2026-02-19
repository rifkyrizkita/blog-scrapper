import { createServerFn } from '@tanstack/react-start'
import z from 'zod'
import { notFound } from '@tanstack/react-router'
import { generateText } from 'ai'
import type { SearchResultWeb } from '@mendable/firecrawl-js'
import { prisma } from '@/db'
import { firecrawl } from '@/lib/firecrawl'
import {
  bulkImportSchema,
  extractSchema,
  importSchema,
  searchSchema,
} from '@/schemas/import'
import { authFnMiddleware } from '@/middlewares/auth'
import { openrouter } from '@/lib/openRouter'

export const scrapeUrlFn = createServerFn({ method: 'POST' })
  .middleware([authFnMiddleware])
  .inputValidator(importSchema)
  .handler(async ({ data, context }) => {
    const item = await prisma.savedItem.create({
      data: {
        url: data.url,
        userId: context.session.user.id,
        status: 'PROCESSING',
      },
    })

    try {
      const result = await firecrawl.scrape(data.url, {
        formats: [
          'markdown',
          {
            type: 'json',
            schema: extractSchema,
          },
        ],
        location: { country: 'US', languages: ['en'] },
        onlyMainContent: true,
        proxy: 'auto',
      })

      const jsonData = result.json as z.infer<typeof extractSchema>

      let publishedAt = null
      if (jsonData.publishedAt) {
        const date = new Date(jsonData.publishedAt)
        if (!isNaN(date.getTime())) {
          publishedAt = date.toISOString()
        }

        const updatedItem = await prisma.savedItem.update({
          where: { id: item.id },
          data: {
            title: result.metadata?.title || null,
            content: result.markdown || null,
            ogImage: result.metadata?.ogImage || null,
            author: jsonData.author || null,
            publishedAt: publishedAt,
            status: 'COMPLETED',
          },
        })
        return updatedItem
      }
    } catch (error) {
      const failedItem = await prisma.savedItem.update({
        where: { id: item.id },
        data: {
          status: 'FAILED',
        },
      })
      return failedItem
    }
  })

export const mapUrlFn = createServerFn({ method: 'POST' })
  .middleware([authFnMiddleware])
  .inputValidator(bulkImportSchema)
  .handler(async ({ data }) => {
    const result = await firecrawl.map(data.url, {
      limit: 25,
      search: data.search,
      location: {
        country: 'US',
        languages: ['en'],
      },
    })
    return result.links
  })

export type BulkScapeProgress = {
  completed: number
  total: number
  url: string
  status: 'success' | 'failed'
}

export const bulkScrapeUrlsFn = createServerFn({ method: 'POST' })
  .middleware([authFnMiddleware])
  .inputValidator(
    z.object({
      urls: z.array(z.string().url()),
    }),
  )
  .handler(async function* ({ data, context }) {
    const total = data.urls.length
    for (let i = 0; i < data.urls.length; i++) {
      const url = data.urls[i]
      const item = await prisma.savedItem.create({
        data: {
          url: url,
          userId: context.session.user.id,
          status: 'PENDING',
        },
      })

      let status: BulkScapeProgress['status'] = 'success'

      try {
        const result = await firecrawl.scrape(url, {
          formats: [
            'markdown',
            {
              type: 'json',
              schema: extractSchema,
            },
          ],
          location: { country: 'US', languages: ['en'] },
          onlyMainContent: true,
          proxy: 'auto',
        })

        const jsonData = result.json as z.infer<typeof extractSchema>

        let publishedAt = null
        if (jsonData.publishedAt) {
          const date = new Date(jsonData.publishedAt)
          if (!isNaN(date.getTime())) {
            publishedAt = date.toISOString()
          }

          await prisma.savedItem.update({
            where: { id: item.id },
            data: {
              title: result.metadata?.title || null,
              content: result.markdown || null,
              ogImage: result.metadata?.ogImage || null,
              author: jsonData.author || null,
              publishedAt: publishedAt,
              status: 'COMPLETED',
            },
          })
        }
      } catch (error) {
        status = 'failed'
        await prisma.savedItem.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
          },
        })
      }
      const progress: BulkScapeProgress = {
        completed: i + 1,
        total: total,
        url: url,
        status: status,
      }
      yield progress
    }
  })

export const getItemsFn = createServerFn({ method: 'GET' })
  .middleware([authFnMiddleware])
  .handler(async ({ context }) => {
    const items = await prisma.savedItem.findMany({
      where: { userId: context.session.user.id },
      orderBy: { createdAt: 'desc' },
    })
    return items
  })

export const getItemByIdFn = createServerFn({ method: 'GET' })
  .middleware([authFnMiddleware])
  .inputValidator(z.object({ id: z.string() }))
  .handler(async ({ context, data }) => {
    const item = await prisma.savedItem.findUnique({
      where: { id: data.id, userId: context.session.user.id },
    })
    if (!item) {
      throw notFound()
    }
    return item
  })

export const saveSummaryAndGenerateTagsFn = createServerFn({ method: 'POST' })
  .middleware([authFnMiddleware])
  .inputValidator(
    z.object({
      id: z.string(),
      summary: z.string(),
    }),
  )
  .handler(async ({ context, data }) => {
    const existing = await prisma.savedItem.findUnique({
      where: { id: data.id, userId: context.session.user.id },
    })
    if (!existing) {
      throw notFound()
    }
    const { text } = await generateText({
      model: openrouter.chat('arcee-ai/trinity-large-preview:free'),
      system: `You are a helpful assistant that extracts relevant tags from content summaries.
Extract 3-5 short, relevant tags that categorize the content.
Return ONLY a comma-separated list of tags, nothing else.
Example: technology, programming, web development, javascript`,
      prompt: `Extract tags from this summary: \n\n${data.summary}`,
    })

    const tags = text
      .split(',')
      .map((tag) => tag.trim().toLowerCase())
      .filter((tag) => tag.length > 0)
      .slice(0, 5)

    const item = await prisma.savedItem.update({
      where: { id: data.id, userId: context.session.user.id },
      data: {
        summary: data.summary,
        tags: tags,
      },
    })
    return item
  })

export const searchWebFn = createServerFn({ method: 'POST' })
  .middleware([authFnMiddleware])
  .inputValidator(searchSchema)
  .handler(async ({ data }) => {
    const result = await firecrawl.search(data.query, {
      limit: 15,
      tbs: 'qdr:y', // past year
    })
    return result.web?.map((item) => ({
      title: (item as SearchResultWeb).title,
      url: (item as SearchResultWeb).url,
      description: (item as SearchResultWeb).description,
    })) as Array<SearchResultWeb>
  })
