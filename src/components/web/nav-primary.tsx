'use client'

import {
  Folder,
  Forward,
  MoreHorizontal,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { Link } from '@tanstack/react-router'
import { NavPrimaryProps } from '@/lib/types'

export function NavPrimary({ items }: NavPrimaryProps) {
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item, index) => {
            return (
              <SidebarMenuItem key={index}>
                <SidebarMenuButton asChild size="sm">
                  <Link
                    activeProps={{
                      'data-active': true,
                    }}
                    to={item.to}
                    activeOptions={item.activeOptions}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
