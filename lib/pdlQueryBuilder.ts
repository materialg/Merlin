import type { QuerySpec } from './types.js';
import { getCoordsFromZip } from './zipLookup.js';

const DEFAULT_RADIUS_MILES = 25;

export function buildPdlQuery(spec: QuerySpec): object {
  const must: any[] = [];
  const mustNot: any[] = [];
  const filter: any[] = [];

  for (const cluster of spec.skill_clusters || []) {
    if (!cluster || cluster.length === 0) continue;
    must.push({
      bool: {
        should: cluster.map(s => ({ term: { skills: s.toLowerCase() } })),
        minimum_should_match: 1,
      },
    });
  }

  if (spec.job_title_sub_roles && spec.job_title_sub_roles.length > 0) {
    must.push({ terms: { job_title_sub_role: spec.job_title_sub_roles } });
  }

  if (typeof spec.years_experience_min === 'number' && spec.years_experience_min > 0) {
    must.push({ range: { inferred_years_experience: { gte: spec.years_experience_min } } });
  }

  must.push({ wildcard: { linkedin_url: '*linkedin.com*' } });

  if (spec.location?.postal_code) {
    const coords = getCoordsFromZip(spec.location.postal_code);
    if (coords) {
      const radius = spec.location.radius_miles ?? DEFAULT_RADIUS_MILES;
      filter.push({
        geo_distance: {
          distance: `${radius}mi`,
          location_geo: `${coords.lat},${coords.lng}`,
        },
      });
    } else {
      filter.push({ term: { location_postal_code: spec.location.postal_code } });
    }
  } else if (spec.location?.region) {
    filter.push({ term: { location_region: spec.location.region.toLowerCase() } });
  }

  if (spec.disqualifiers?.levels && spec.disqualifiers.levels.length > 0) {
    mustNot.push({ terms: { job_title_levels: spec.disqualifiers.levels } });
  }

  return {
    query: {
      bool: {
        must,
        must_not: mustNot,
        filter,
      },
    },
    size: 25,
  };
}
