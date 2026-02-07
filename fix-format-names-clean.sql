-- Nettoyer tous les format_name pour qu'ils soient juste des clés simples
-- Pas des chemins complets comme "messenger.formats.names.date"

-- Si le format_name contient le chemin complet, extraire juste la clé finale
UPDATE messenger_validation_formats
SET format_name = SUBSTRING(format_name FROM 'messenger\.formats\.names\.(.*)')
WHERE format_name LIKE 'messenger.formats.names.%';

-- Sinon, normaliser les valeurs textuelles vers les clés appropriées
UPDATE messenger_validation_formats
SET format_name = 'email'
WHERE format_name LIKE '%Email%' AND format_name NOT IN ('email');

UPDATE messenger_validation_formats
SET format_name = 'phone'
WHERE (format_name LIKE '%léphone%' OR format_name LIKE '%Phone%' OR format_name LIKE '%Téléphone%') AND format_name NOT IN ('phone');

UPDATE messenger_validation_formats
SET format_name = 'full_name'
WHERE (format_name LIKE '%Nom complet%' OR format_name LIKE '%Full name%') AND format_name NOT IN ('full_name');

UPDATE messenger_validation_formats
SET format_name = 'date'
WHERE (format_name LIKE '%Date%' OR format_name LIKE '%date%') AND format_name NOT IN ('date');

UPDATE messenger_validation_formats
SET format_name = 'number'
WHERE (format_name LIKE '%Nombre%' OR format_name LIKE '%Number%') AND format_name NOT IN ('number');

UPDATE messenger_validation_formats
SET format_name = 'text_free'
WHERE (format_name LIKE '%Texte libre%' OR format_name LIKE '%Free text%' OR format_name LIKE '%Text libre%') AND format_name NOT IN ('text_free');

-- Afficher le résultat final
SELECT format_code, format_name FROM messenger_validation_formats ORDER BY format_code;
