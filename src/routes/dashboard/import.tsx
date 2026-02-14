import { useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { Globe, LinkIcon, Loader2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import type { SearchResultWeb } from '@mendable/firecrawl-js'
import type {
  BulkScapeProgress} from '@/data/items';
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  bulkScrapeUrlsFn,
  mapUrlFn,
  scrapeUrlFn,
} from '@/data/items'
import { bulkImportSchema, importSchema } from '@/schemas/import'


export const Route = createFileRoute('/dashboard/import')({
  component: RouteComponent,
})

function RouteComponent() {
  const [isPending, startTransition] = useTransition()
  const [bulkIsPending, startBulkTransition] = useTransition()
  const [progress, setProgress] = useState<BulkScapeProgress | null>(null)

  // bulk import state
  const [discoveredLinks, setDiscoveredLinks] = useState<
    Array<SearchResultWeb>
  >([])

  const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set())

  function handleSelectAll() {
    if (selectedUrls.size === discoveredLinks.length) {
      setSelectedUrls(new Set())
    } else {
      setSelectedUrls(new Set(discoveredLinks.map((link) => link.url)))
    }
  }

  function handleToggleUrl(url: string) {
    const newSelectedUrls = new Set(selectedUrls)
    if (newSelectedUrls.has(url)) {
      newSelectedUrls.delete(url)
    } else {
      newSelectedUrls.add(url)
    }
    setSelectedUrls(newSelectedUrls)
  }

  function handleBulkImport() {
    startBulkTransition(async () => {
      if (selectedUrls.size === 0) {
        toast.error('Please select at least one URL to import.')
        return
      }

      setProgress({
        completed: 0,
        total: selectedUrls.size,
        url: '',
        status: 'success',
      })

      let successCount = 0
      let failedCount = 0

      for await (const update of await bulkScrapeUrlsFn({
        data: { urls: Array.from(selectedUrls) },
      })) {
        setProgress(update)
        if (update.status === 'success') {
          successCount++
        } else {
          failedCount++
        }
      }
      setProgress(null)

      if (failedCount > 0) {
        toast.success(
          `Imported ${successCount} URLs with ${failedCount} failures.`,
        )
      } else {
        toast.success(`Successfully imported ${successCount} URLs.`)
      }
    })
  }

  const form = useForm({
    defaultValues: {
      url: '',
    },
    validators: {
      onSubmit: importSchema,
    },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        console.log('Value :', value)
        await scrapeUrlFn({ data: value })
        toast.success('URL scraped successfully!')
      })
    },
  })

  const bulkForm = useForm({
    defaultValues: {
      url: '',
      search: '',
    },
    validators: {
      onSubmit: bulkImportSchema,
    },
    onSubmit: ({ value }) => {
      startTransition(async () => {
        const data = await mapUrlFn({ data: value })
        setDiscoveredLinks(data)
      })
    },
  })

  return (
    <div className="flex flex-1 items-center justify-center py-8">
      <div className="w-full max-w-2xl space-y-6 px-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Import Content</h1>
          <p className="text-muted-foreground pt-1">
            Save web page to your library for later reading
          </p>
        </div>
        <Tabs defaultValue="single">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="single" className="gap-2">
              <LinkIcon className="size-4" /> Single URL
            </TabsTrigger>
            <TabsTrigger value="bulk" className="gap-2">
              <Globe className="size-4" /> Bulk Import
            </TabsTrigger>
          </TabsList>
          <TabsContent value="single">
            <Card>
              <CardHeader>
                <CardTitle>Import Single URL</CardTitle>
                <CardDescription>
                  Scrape and save content from any web app!👀
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    form.handleSubmit()
                  }}
                >
                  <FieldGroup>
                    <form.Field
                      name="url"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>URL</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                              placeholder="https://tanstack.com/start/latest"
                              autoComplete="off"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        )
                      }}
                    />

                    <Button type="submit" disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Import URL'
                      )}
                    </Button>
                  </FieldGroup>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="bulk">
            <Card>
              <CardHeader>
                <CardContent></CardContent>
                <CardTitle>Import Bulk URLs</CardTitle>
                <CardDescription>
                  Dicover and import multiple URLs from a website at once!🚀
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    bulkForm.handleSubmit()
                  }}
                >
                  <FieldGroup>
                    <bulkForm.Field
                      name="url"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>URL</FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                              placeholder="https://tanstack.com/start/latest"
                              autoComplete="off"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        )
                      }}
                    />
                    <bulkForm.Field
                      name="search"
                      children={(field) => {
                        const isInvalid =
                          field.state.meta.isTouched &&
                          !field.state.meta.isValid
                        return (
                          <Field data-invalid={isInvalid}>
                            <FieldLabel htmlFor={field.name}>
                              Filter (optional)
                            </FieldLabel>
                            <Input
                              id={field.name}
                              name={field.name}
                              value={field.state.value}
                              onBlur={field.handleBlur}
                              onChange={(e) =>
                                field.handleChange(e.target.value)
                              }
                              aria-invalid={isInvalid}
                              placeholder="e.g. tutorial, blog, docs"
                              autoComplete="off"
                            />
                            {isInvalid && (
                              <FieldError errors={field.state.meta.errors} />
                            )}
                          </Field>
                        )
                      }}
                    />
                    <Button type="submit" disabled={isPending}>
                      {isPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          processing...
                        </>
                      ) : (
                        'Import URLs'
                      )}
                    </Button>
                  </FieldGroup>
                </form>
                {/* Discovered URLs list */}
                {discoveredLinks.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        Found {discoveredLinks.length} URLs
                      </p>
                      <Button
                        onClick={handleSelectAll}
                        variant="outline"
                        size="sm"
                      >
                        {selectedUrls.size === discoveredLinks.length
                          ? 'Deselect All'
                          : 'Select All'}
                      </Button>
                    </div>
                    <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-4">
                      {discoveredLinks.map((link) => (
                        <label
                          key={link.url}
                          className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md p-2 "
                        >
                          <Checkbox
                            checked={selectedUrls.has(link.url)}
                            onCheckedChange={() => handleToggleUrl(link.url)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">
                              {link.title ?? 'Title has not been provided'}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {link.description ??
                                'Description has not been provided'}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {link.url}
                            </p>
                          </div>
                        </label>
                      ))}
                    </div>
                    {progress && (
                      <div className="  space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            Importing {progress.completed} of {progress.total}:
                          </span>
                          <span className="font-medium">
                            {Math.round(
                              (progress.completed / progress.total) * 100,
                            )}
                            %
                          </span>
                        </div>
                        <Progress
                          value={(progress.completed / progress.total) * 100}
                        />
                      </div>
                    )}
                    <Button
                      disabled={bulkIsPending}
                      onClick={handleBulkImport}
                      type="button"
                      className="w-full"
                    >
                      {bulkIsPending ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          {progress
                            ? `Importing ${progress.completed}/${progress.total}...`
                            : 'Starting Import...'}
                        </>
                      ) : (
                        `Import ${selectedUrls.size} URLs`
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
