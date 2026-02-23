# 🌿 Bulk Plant Import — CSV Generation Prompt

Use the prompt below with any AI assistant (ChatGPT, Gemini, Claude, etc.) to generate a
correctly-formatted CSV file that can be directly imported into the **Landschaft Plants
Database** via the **Import CSV** button on the Plant Catalog page.

> **✨ Smart Import:** When you import a CSV, the system automatically runs the same
> AI autofill used by the normal plant form for every row. Any field you leave blank
> (description, care, diseases, images) is filled in by AI. Images are automatically
> fetched and uploaded to **Cloudinary** — you never need to provide image URLs manually.

---

## ✅ CSV Column Reference

### Taxonomy (builds the taxonomy tree automatically)

| Column | Required | Example | Notes |
|---|---|---|---|
| `kingdom` | **Yes** | `Plantae` | Taxonomic Kingdom |
| `division` | No | `Tracheophyta` | Taxonomic Division / Phylum |
| `class` | No | `Magnoliopsida` | Taxonomic Class |
| `order` | No | `Rosales` | Taxonomic Order |
| `family` | No | `Rosaceae` | Taxonomic Family |
| `genus` | No | `Rosa` | Taxonomic Genus |
| `species` | **Yes** | `Rosa rubiginosa` | Full binomial name (Genus + epithet) |

### Plant Identity

| Column | Required | Example | Notes |
|---|---|---|---|
| `common_name` | **Yes** | `Sweet Brier Rose` | Human-readable plant name |
| `scientific_name` | No | `Rosa rubiginosa` | Overrides auto-derived name if provided |
| `category` | No | `Shrub` | See valid values below. Defaults to `Other` |
| `planting_place` | No | `Outdoor` | `Indoor`, `Outdoor`, or `Indoor & Outdoor`. Defaults to `Indoor & Outdoor` |
| `description` | No | Free text | 1–2 sentence botanical/horticultural summary. **AI fills this if blank.** |
| `common_diseases` | No | Free text | Known diseases, pests, and susceptibilities. **AI fills this if blank.** |

### Care Information

| Column | Required | Example | Notes |
|---|---|---|---|
| `care_water` | No | `Water twice a week; avoid waterlogging` | Watering schedule and amount. **AI fills this if blank.** |
| `care_sunlight` | No | `Full sun; at least 6 hours daily` | Light requirements. **AI fills this if blank.** |
| `care_soil` | No | `Well-draining loamy soil, pH 6–7` | Soil type, drainage, and pH. **AI fills this if blank.** |
| `care_maintenance` | No | `Prune after flowering; fertilise monthly` | Pruning, fertilising, repotting. **AI fills this if blank.** |

### Images (Wikimedia Commons — same source as AI autofill)

| Column | Required | Example | Notes |
|---|---|---|---|
| `icon_url` | No | `https://commons.wikimedia.org/wiki/Special:FilePath/Rosa_rubiginosa.jpg?width=400` | Wikimedia thumbnail (width=400). Use `Scientific_Name.jpg` with underscores. Leave blank if uncertain. |
| `image_url` | No | `https://commons.wikimedia.org/wiki/Special:FilePath/Rosa_rubiginosa.jpg?width=1000` | Wikimedia hero image (width=1000). Same filename as icon, different width. Leave blank if uncertain. |

> **Valid `category` values:** `Tree`, `Shrub`, `Herb`, `Creeper`, `Palm`, `Grass`,
> `Succulent`, `Fern`, `Aquatic`, `Other`

> **Important rules:**
> - `kingdom`, `species`, and `common_name` are **mandatory** on every row.
> - The `species` column must be the **full binomial name** (e.g. `Quercus robur`), not just the epithet.
> - `planting_place` must be exactly one of: `Indoor`, `Outdoor`, or `Indoor & Outdoor`.
> - Rows with duplicate species (already in the database) are **skipped silently**.
> - Wrap any cell containing commas in **double-quotes**.
> - Columns can be in **any order** as long as the header names match exactly.
> - Unused optional columns can simply be left empty — do **not** omit the column header.

---

## 📋 Copy-Paste Prompt for AI

> Replace **[YOUR LIST]** with your actual list of plant names before sending.

---

```
You are a professional botanist and horticulturalist with expertise in landscape design.

I need a CSV file for bulk-importing plants into a landscape design database.
Generate a CSV for the following plants:

[YOUR LIST]
(e.g.)
- Ficus elastica (Rubber Plant)
- Bambusa vulgaris (Common Bamboo)
- Aloe vera
- Phoenix dactylifera (Date Palm)
- Jasminum sambac (Arabian Jasmine)

The CSV must have EXACTLY these columns in this order:
kingdom,division,class,order,family,genus,species,common_name,scientific_name,category,planting_place,description,common_diseases,care_water,care_sunlight,care_soil,care_maintenance,icon_url,image_url

Rules:
1. Fill in ALL taxonomy columns (kingdom → genus) accurately using accepted botanical classification.
2. The `species` column must be the full binomial name (e.g. "Bambusa vulgaris"), NOT just the epithet.
3. `scientific_name` should be the same as `species` (or include author citation if known).
4. `category` must be exactly one of: Tree, Shrub, Herb, Creeper, Palm, Grass, Succulent, Fern, Aquatic — pick the most botanically appropriate.
5. `planting_place` must be exactly one of: Indoor, Outdoor, Indoor & Outdoor
6. `description`: 1–2 sentences covering ecology, growth habit, and landscape use.
7. `common_diseases`: list the 2–4 most common diseases or pests this plant faces.
8. `care_water`: describe the watering schedule, frequency, and any drought/wet tolerance.
9. `care_sunlight`: describe light needs — full sun, partial shade, indirect light, etc.
10. `care_soil`: describe ideal soil type, drainage needs, and pH range.
11. `care_maintenance`: describe pruning frequency, fertiliser type and schedule, and any special care notes.
12. `icon_url`: Construct a direct Wikimedia Commons Special:FilePath URL for a thumbnail image.
    - Format EXACTLY: https://commons.wikimedia.org/wiki/Special:FilePath/<Scientific_Name>.jpg?width=400
    - Replace spaces in the scientific name with underscores (e.g. "Ficus elastica" → "Ficus_elastica.jpg").
    - Use ONLY the standard filename "Scientific_Name.jpg" — do NOT append words like "fruit", "leaves", or "flower" unless you are 100% certain that variant is the primary image for this plant on Wikimedia Commons.
    - Output the plain URL only — NO Markdown formatting like [url](url), NO brackets, NO parentheses around it.
    - This must be a single plain URL in its own CSV column cell. Do NOT combine both URLs into one cell.
    - If you are uncertain whether the image exists, leave this cell blank.
13. `image_url`: Exactly the same rule as `icon_url` but use `?width=1000` instead of `?width=400`. Put it in the NEXT column — one URL per column, never combined.
14. Use standard CSV formatting (comma-delimited). Wrap any cell containing a comma in double-quotes.
15. Output ONLY the raw CSV text — no markdown fences, no explanation, no extra text.
```

---

## 📄 Sample Output (what you should receive)

```csv
kingdom,division,class,order,family,genus,species,common_name,scientific_name,category,planting_place,description,common_diseases,care_water,care_sunlight,care_soil,care_maintenance,icon_url,image_url
Plantae,Tracheophyta,Magnoliopsida,Rosales,Moraceae,Ficus,Ficus elastica,Rubber Plant,Ficus elastica,Tree,Indoor,"A large evergreen tree with broad glossy leaves, popular as an indoor specimen plant in tropical climates.","Root rot; scale insects; leaf drop from overwatering","Water when top 2–3 cm of soil is dry; reduce in winter","Bright indirect light; avoid direct afternoon sun","Well-draining potting mix with perlite; pH 6–7","Wipe leaves monthly; repot every 2 years; fertilise monthly with balanced liquid feed",,
Plantae,Tracheophyta,Liliopsida,Poales,Poaceae,Bambusa,Bambusa vulgaris,Common Bamboo,Bambusa vulgaris,Grass,Outdoor,"Fast-growing tropical bamboo used for screening, shade, and structural landscaping.","Aphids; rust fungus; mealybugs","Water deeply twice a week; drought-tolerant once established","Full sun; minimum 6 hours daily","Loamy well-draining soil; pH 5.5–7; tolerates clay","Remove dead culms annually; divide clumps every 4–5 years; fertilise in spring",,
```

> **Note:** The two trailing commas on each row represent the blank `icon_url` and `image_url` columns.
> The system will automatically fetch and upload images to Cloudinary during import.

---

## 🚀 How to Import

1. Save the AI output as a `.csv` file (e.g. `my_plants.csv`).
2. Open the **Plant Catalog** page in the Landschaft app.
3. Click the **Import CSV** button (top-right of the toolbar).
4. Select your `.csv` file — the import runs automatically.
   - For each plant, it reads the CSV data, runs AI autofill on missing fields,
     fetches images from Wikimedia, and uploads them to Cloudinary.
   - **This can take 5–15 seconds per plant** — please wait for the success message.
5. A success message shows how many plants were **added** and how many **failed**.

> **Tip:** Failed rows are listed individually in the import response with the reason.  
> Fix only those rows and re-import — duplicates are skipped automatically, so it is safe to re-run.

---

## 🛠 Troubleshooting

| Error | Fix |
|---|---|
| `Missing required columns: kingdom` | Check the header row — column names must be lowercase and spelled exactly as shown |
| `Kingdom is mandatory` | The `kingdom` cell is empty for that row — fill it in |
| `Species name mandatory` | The `species` cell is empty — provide the full binomial name |
| `Row X: ...` | Check row X in your CSV for typos or empty required fields |
| Import button does nothing | Make sure the file extension is `.csv` (not `.xlsx` or `.xls`) |
| Care data not showing | Confirm column headers are `care_water`, `care_sunlight`, `care_soil`, `care_maintenance` (exact spelling) |
| `planting_place` defaulting to `Indoor & Outdoor` | Value must be exactly `Indoor`, `Outdoor`, or `Indoor & Outdoor` — check for extra spaces |
| Images not appearing | Cloudinary may have timed out — open the plant and use the AI autofill button to re-fetch |
