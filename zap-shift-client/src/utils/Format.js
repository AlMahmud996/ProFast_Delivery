// Shared formatting helpers (kept out of component files so React Fast Refresh works)

// ৳1,234.5 style money
export const money = (n) =>
    `৳${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// e.g. "15 Oct 2026, 3:36 PM"
export const formatDate = (iso) =>
    iso
        ? new Date(iso).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
          })
        : "—";