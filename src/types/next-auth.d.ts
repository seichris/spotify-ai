import type { DefaultSession } from "next-auth"

declare module "next-auth" {
    interface Session {
        access_token?: string
        error?: string
        user: {
            address?: string
        } & DefaultSession["user"]
    }
}

declare module "next-auth/jwt" {
    interface JWT {
        access_token?: string
        expires_at?: number
        refresh_token?: string
        error?: string
    }
}
