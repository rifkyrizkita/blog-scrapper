import type {User} from 'better-auth';
import type { LucideIcon } from 'lucide-react'

export interface NavPrimaryProps {
  items: Array<{
    title: string
    to: string
    icon: LucideIcon
    activeOptions: { exact: boolean }
  }>
}

export interface NavUserProps {
  user: User
}
