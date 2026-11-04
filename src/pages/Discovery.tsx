/* Enesa Sejdiu: Homepage and category views. */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchFront } from '../api'
import { HScroll, Loading, SectionTitle, VenueCard } from '../components'
import { useApp } from '../state'
import type { DiscoveryPage } from '../types'

/* Enesa Sejdiu: Resolves a section link to a category or collection route. */
function seeAllPath(seeAll: string | null) {
  if (!seeAll) return undefined
  if (seeAll === '__categories') return '/categories'
  return `/list/${seeAll}`
}

/* Enesa Sejdiu: Homepage for the selected city. */
export function Discovery() {
  const { city } = useApp()
  const [page, setPage] = useState<DiscoveryPage | null>(null)

  useEffect(() => {
    let cancel = false
    setPage(null)
    fetchFront(city)
      .then((next) => { if (!cancel) setPage(next) })
      .catch(() => { if (!cancel) setPage({ title: '', sections: [] }) })
    return () => { cancel = true }
  }, [city])

  useEffect(() => {
    document.title = `Wolt | ${city.name}`
  }, [city.name])

  if (!page) return <Loading />

  return (
    <div className="page">
      {page.sections.map((section) => {
        /* Enesa Sejdiu: Promotional banner row. */
        if (section.template === 'banner-hero' && section.banners.length) {
          return (
            <section key={section.id} className="block">
              <HScroll>
                {section.banners.map((banner) => (
                  <Link key={banner.id} to={banner.target ? `/list/${banner.target}` : '/restaurants'} className="hero">
                    <img src={banner.image} alt={banner.title || 'Offer'} />
                  </Link>
                ))}
              </HScroll>
            </section>
          )
        }
        /* Enesa Sejdiu: Category and brand tiles. */
        if (section.banners.length && !section.venues.length) {
          const categories = section.template === 'banner-small' && section.banners.some((banner) => banner.title)
          return (
            <section key={section.id} className="block">
              <SectionTitle title={section.title} to={seeAllPath(section.seeAll)} />
              <HScroll>
                {section.banners.map((banner) => (
                  <Link key={banner.id} to={banner.target ? `/list/${banner.target}` : '/restaurants'} className={categories ? 'cat-tile' : 'brand-tile'}>
                    <img src={banner.image} alt="" />
                    {banner.title && <span>{banner.title}</span>}
                  </Link>
                ))}
              </HScroll>
            </section>
          )
        }
        /* Enesa Sejdiu: Horizontal venue row. */
        if (!section.venues.length) return null
        return (
          <section key={section.id} className="block">
            <SectionTitle title={section.title} to={seeAllPath(section.seeAll)} />
            <HScroll>
              {section.venues.map((venue) => (
                <div className="vcard-slot" key={venue.id}>
                  <VenueCard venue={venue} />
                </div>
              ))}
            </HScroll>
          </section>
        )
      })}
    </div>
  )
}

/* Enesa Sejdiu: Full category index. */
export function Categories() {
  const { city } = useApp()
  const [page, setPage] = useState<DiscoveryPage | null>(null)
  useEffect(() => {
    document.title = `Categories | Wolt`
    fetchFront(city).then(setPage).catch(() => setPage({ title: '', sections: [] }))
  }, [city])
  if (!page) return <Loading label="Loading categories" />
  const section = page.sections.find((item) => item.id === 'category-list')
  return (
    <div className="page">
      <h1>Categories</h1>
      <div className="cat-grid">
        {(section?.banners || []).map((banner) => (
          <Link key={banner.id} to={banner.target ? `/list/${banner.target}` : '/restaurants'} className="cat-tile">
            <img src={banner.image} alt="" />
            <span>{banner.title}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
