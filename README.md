# Kilitos

Bitácora diaria de peso, ejercicio y calorías. App web estática (PWA) sin dependencias: HTML + CSS + JS puro, datos guardados en el navegador (localStorage) con exportación/importación a JSON.

## Uso en local

Opción rápida: abrir `index.html` con doble clic.

Opción con servidor (recomendada para probar la PWA e instalarla en el móvil):

```powershell
python -m http.server 8080
```

Y abrir http://localhost:8080

## Publicar en GitHub Pages

```powershell
git init
git add .
git commit -m "Kilitos"
git branch -M main
git remote add origin https://github.com/TUUSUARIO/kilitos.git
git push -u origin main
```

Luego en GitHub: Settings → Pages → Deploy from branch → main / root.

## Copias de seguridad

Los datos viven solo en cada navegador/dispositivo. En **Perfil → Mis datos** puedes exportar/importar una copia JSON. Al abrir la app desde otra URL (local vs. GitHub Pages) el almacenamiento es distinto: importa tu copia para continuar donde lo dejaste.
