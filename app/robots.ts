//Test

import type { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.qcurobotics.website'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /admin and /member-reg are kept out of search by a "noindex" header + tag on the pages themselves. They must stay
      // crawlable here: a page blocked in robots.txt can't show Google its noindex, and could still be listed by its address alone.
      disallow: ['/api/'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
