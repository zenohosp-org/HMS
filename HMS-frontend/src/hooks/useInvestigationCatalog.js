import { useEffect, useState } from "react";
import { departmentApi, hospitalServiceApi, labCatalogApi } from "@/utils/api";

/**
 * Single source for the orderable investigation catalogue used by every order
 * picker (IPD Labs tab, Consultation View, Consultation modal).
 *
 * For gated tenants it reads the labs catalogue (lab_services) directly from
 * the labs service (labCatalogApi -> api-labs) — labs owns the discipline +
 * price, so a radiology test can never be misclassified as pathology. The
 * read bypasses the HMS /api/lab-services proxy: the HMS Render edge returned
 * a 502 on that 45 KB catalogue payload even though Spring Boot answered 200,
 * and the direct call matches the radiology/investigations reads. For every other
 * tenant it falls back to the legacy hospital_services + department.code
 * derivation, so the rollout is per-tenant: a hospital whose radiology
 * catalogue has not yet been seeded on the labs side keeps its current picker
 * instead of losing radiology entirely.
 *
 * Gate (mirrors labs' own seed allow-list):
 *   VITE_LABS_CATALOG_HOSPITAL_IDS = ""            -> all tenants use legacy
 *   VITE_LABS_CATALOG_HOSPITAL_IDS = "<uuid>,..."  -> those tenants use labs
 *   VITE_LABS_CATALOG_HOSPITAL_IDS = "ALL"         -> fleet (post-GA)
 */
const RAW = (import.meta.env.VITE_LABS_CATALOG_HOSPITAL_IDS || "").trim();
const LABS_CATALOG_ALL = RAW.toUpperCase() === "ALL";
const LABS_CATALOG_IDS = new Set(
  RAW && !LABS_CATALOG_ALL ? RAW.split(",").map((s) => s.trim()).filter(Boolean) : []
);
const usesLabsCatalog = (hospitalId) =>
  LABS_CATALOG_ALL || (hospitalId != null && LABS_CATALOG_IDS.has(String(hospitalId)));

// hospital_services department.code -> investigation kind (legacy source).
const kindFromCode = (code) => {
  const c = (code || "").toUpperCase();
  if (c === "LABS") return "LAB";
  if (c === "RADIOLOGY") return "RADIOLOGY";
  return null;
};

/**
 * Adapt a labs lab_services row to the picker's catalogue shape. Discipline is
 * authoritative — RADIOLOGY routes to the radiology pipeline, everything else
 * (PATHOLOGY/CYTOLOGY/HISTOPATHOLOGY) to lab. Child analytes (parentPanelCode
 * set) are dropped — you order the panel, not its components (this is labs'
 * orderableOnly default, applied client-side until their 8.2 envelope lands).
 * labServiceId is carried for the V15 catalog-linked create; the order payload
 * keeps sending free-text serviceName/price until that ships.
 */
const adaptLabsRow = (r) => ({
  id: r.id,
  labServiceId: r.id,
  name: r.name,
  kind: r.discipline === "RADIOLOGY" ? "RADIOLOGY" : "LAB",
  price: r.price,
  gstRate: r.gstRate,
  department: { name: r.category || r.discipline },
  discipline: r.discipline,
});

export function useInvestigationCatalog(hospitalId) {
  const [catalog, setCatalog] = useState([]);

  useEffect(() => {
    if (!hospitalId) { setCatalog([]); return undefined; }
    let cancelled = false;

    if (usesLabsCatalog(hospitalId)) {
      // Proxied through the HMS backend so the SPA stays single-origin (one SSO
      // cookie); labs reads hospitalId off the forwarded JWT. .catch => [] so a
      // labs outage degrades to an empty picker, never a broken tab.
      labCatalogApi.list({ active: true })
        .then((rows) => {
          if (cancelled) return;
          const list = Array.isArray(rows) ? rows : [];
          setCatalog(list.filter((r) => r.active !== false && !r.parentPanelCode).map(adaptLabsRow));
        })
        .catch(() => { if (!cancelled) setCatalog([]); });
    } else {
      Promise.all([departmentApi.list(hospitalId), hospitalServiceApi.list(hospitalId)])
        .then(([depts, services]) => {
          if (cancelled) return;
          const kindByDeptId = {};
          (depts || []).forEach((d) => {
            const k = kindFromCode(d.code);
            if (k) kindByDeptId[d.id] = k;
          });
          setCatalog(
            (services || [])
              .filter((s) => s.isActive !== false && kindByDeptId[s.departmentId])
              .map((s) => ({ ...s, kind: kindByDeptId[s.departmentId] }))
          );
        })
        .catch(() => { if (!cancelled) setCatalog([]); });
    }

    return () => { cancelled = true; };
  }, [hospitalId]);

  return catalog;
}
