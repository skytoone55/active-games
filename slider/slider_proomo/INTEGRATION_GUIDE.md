# 🎮 Guide d'intégration du Widget Active Games sur Laser City

## Méthode 1 : Code externe (Recommandé)

### Étape 1 : Uploader le fichier JS
1. Upload le fichier `active-games-widget.js` sur ton serveur laser-city.co.il
2. Place-le dans un dossier comme `/js/` ou `/scripts/`

### Étape 2 : Ajouter le script au site
Ajoute cette ligne **juste avant la balise `</body>`** sur toutes les pages où tu veux afficher le widget :

```html
<script src="/js/active-games-widget.js"></script>
```

Ou avec le chemin complet :
```html
<script src="https://laser-city.co.il/js/active-games-widget.js"></script>
```

C'est tout ! Le widget apparaîtra automatiquement.

---

## Méthode 2 : Code inline (Alternative)

Si tu ne peux pas uploader de fichier JS, ajoute directement ce code **avant `</body>`** :

```html
<script src="https://activegames.co.il/js/active-games-widget.js"></script>
```

(Tu devras d'abord uploader le fichier JS sur le serveur d'activegames.co.il)

---

## Méthode 3 : Google Tag Manager (Si tu l'utilises)

1. Va dans Google Tag Manager
2. Créer une nouvelle balise → Type: "HTML personnalisé"
3. Colle le contenu de `active-games-widget.js` entre des balises `<script></script>`
4. Déclencheur : "All Pages" ou sélectionne les pages spécifiques
5. Publier

---

## Méthode 4 : WordPress (Si le site est sous WordPress)

### Option A : Via le thème
1. Va dans **Apparence → Éditeur de thème**
2. Ouvre le fichier `footer.php`
3. Ajoute avant `<?php wp_footer(); ?>` :
```php
<script src="<?php echo get_template_directory_uri(); ?>/js/active-games-widget.js"></script>
```
4. Upload `active-games-widget.js` dans le dossier `/wp-content/themes/ton-theme/js/`

### Option B : Via un plugin
1. Installe le plugin "Insert Headers and Footers" ou "Code Snippets"
2. Ajoute le code du widget dans la section Footer
3. Sauvegarde

---

## Configuration

### Personnalisation du délai de réapparition
Par défaut, le widget ne réapparaît pas pendant 24h après fermeture. Pour modifier :

Dans `active-games-widget.js`, ligne 10, change :
```javascript
if (closedTime && (Date.now() - parseInt(closedTime)) < 24 * 60 * 60 * 1000) {
```

Exemples :
- **1 heure** : `1 * 60 * 60 * 1000`
- **12 heures** : `12 * 60 * 60 * 1000`
- **7 jours** : `7 * 24 * 60 * 60 * 1000`

### Désactiver la fermeture permanente
Pour que le widget réapparaisse à chaque visite, supprime les lignes 6-13 dans le fichier JS.

---

## Test

1. Ouvre ton site laser-city.co.il
2. Le widget devrait apparaître sur le côté gauche
3. Test sur mobile : le widget apparaît en bas
4. Clique sur le X : le widget disparaît
5. Recharge la page : le widget ne réapparaît pas (pendant 24h)

---

## Dépannage

### Le widget n'apparaît pas ?
1. Vérifie que le script est bien chargé (F12 → Console → cherche des erreurs)
2. Vérifie le chemin du fichier JS
3. Vide le cache du navigateur (Ctrl+F5)

### Le widget est mal positionné ?
Modifie dans le CSS (dans le fichier JS) :
```css
.active-games-widget {
    left: 20px;  /* Distance du bord gauche */
    top: 50%;    /* Position verticale */
}
```

### Conflit avec d'autres éléments ?
Augmente le z-index :
```css
.active-games-widget {
    z-index: 999999;  /* Au lieu de 99999 */
}
```

---

## 📱 Support

Le widget est :
- ✅ Responsive (mobile + desktop)
- ✅ Compatible tous navigateurs modernes
- ✅ Optimisé performance (lazy load)
- ✅ Ne ralentit pas le site

---

## 🎯 Fichiers nécessaires

- `active-games-widget.js` - Script du widget (à uploader sur laser-city.co.il)
- Vidéo : https://activegames.co.il/videos/activegames.mp4 (déjà en ligne)
- Logo : https://activegames.co.il/images/logo-activegames.png (déjà en ligne)

Aucun autre fichier nécessaire ! Tout est inclus dans le JS.
