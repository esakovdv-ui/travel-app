# Фото регионов для шага «Куда»

Локальные копии с Wikimedia Commons (CC / public domain).

| Файл | Сюжет | Источник |
|------|--------|----------|
| sea.jpg | Чёрное море у Сочи | Black Sea in Sochi… |
| podmos.jpg | Царицыно | Tsaritsyno Park… |
| spb.jpg | Зимний дворец сверху | Aerial view of the Winter Palace… |
| kaliningrad.jpg | Рыбная деревня | Fish village in Kaliningrad… |
| kazan.jpg | Казанский кремль, Спасская башня | Kazan Kremlin. Spasskaya Tower P8111872 |
| other.jpg | Катунь, Алтай | Katun river Altai… |
| karelia.jpg | Озёра и лес Карелии | сгенерировано |
| kaluga.jpg | Набережная Калуги | сгенерировано |
| altai.jpg | Катунь, горы Алтая | сгенерировано |
| yaroslavl.jpg | Набережная и собор, Ярославль | сгенерировано |
| nnovgorod.jpg | Нижегородский кремль | сгенерировано |
| vladimir.jpg | Успенский собор, Владимир | сгенерировано |

## Мобильные версии (`mobile/`)

На экранах ≤559px подгружаются уменьшенные JPEG (~400px, ~30–50 KB вместо ~200 KB).

Пересобрать из полноразмерных:

```bash
for f in sea podmos spb kaliningrad kazan other karelia kaluga altai yaroslavl nnovgorod vladimir; do
  sips -Z 400 "$f.jpg" --out "mobile/$f.jpg" -s format jpeg -s formatOptions 75
done
```
