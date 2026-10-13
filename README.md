# SteppedIn theme (Online Store 2.0)

Upload: Online Store > Themes > Add theme > Upload zip. Customise: every page is built from sections you can add, remove, reorder and edit in the theme editor.

## Before you launch
1. **Size option**: every sneaker needs an option named exactly `Size` (change in Theme settings > Sneaker settings). Use UK sizes as values (6, 6.5, 7...).
2. **Filters**: install Shopify Search & Discovery. Add filters for Size, Brand, Colour, Price, Condition, Availability. Collection and search filtering is native and powered by it.
3. **Collection hubs**: assign template `collection.silhouette` to silhouette collections (Jordan 1, Samba...). Per-collection copy uses metafields: `custom.intro` (rich text), `custom.about` (rich text), `custom.faq` (JSON: [{"question":"","answer":""}]). Without them, the section blocks are used.
4. **Product metafields (optional)**: `custom.delivery_speed` (text), `custom.fit_note` (text). Complementary products: set in Search & Discovery.
5. **Reviews**: install a reviews app and add its app block to the Product reviews section. Star ratings in Google need the app to write `reviews.rating` and `reviews.rating_count`. Manual review blocks are display only.
6. **Society and back-in-stock**: both create customers tagged `society` / `back-in-stock`, `bis-[handle]`, `bis-size-[size]`. Use Shopify Flow or Klaviyo to send the emails and to run Society perks. Shopify does not email back-in-stock by itself.
7. **Klarna / Clearpay**: the product page line is text only. Enable the providers in Shopify Payments or via their apps.
8. **Navigation**: header and footer menus are picked in the editor. Create the menus first.
9. **Fonts** load from Google Fonts. Self-host Bricolage Grotesque and Archivo for best speed and GDPR.
10. Replace sample copy, review quotes and placeholder numbers in the sections.
