# Quoteslip

A small quote calculator for freelance web projects, priced in naira.

Pick a package, extra pages and add-ons. An itemised slip updates as you go. Rates are editable and saved in the browser only. The quote can be copied as text or printed to PDF.

## Run locally

It is a static site with no build step.

```
npx serve .
```

## Deploy

Import the repo in Vercel. No build command and no output directory are needed. Security headers are set in `vercel.json`.

## Notes

- No data leaves the browser. There is no backend and no tracking.
- Default rates are examples. Change them under "Edit my rates".
