-- Zrušení limitu velikosti souboru v bucketu poptavka-fotky (aplikace neblokuje velikost)
update storage.buckets
set file_size_limit = null
where id = 'poptavka-fotky';
