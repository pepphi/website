# Peppi Hietanen – CV-sivusto

Staattinen, interaktiivinen CV-sivusto suomeksi, englanniksi ja ruotsiksi. Ei build-vaihetta – avaa `index.html` selaimessa tai palvele kansio millä tahansa staattisella palvelimella.

- `index.html` – etusivu
- `privacy.html` – tietosuojaseloste
- `assets/i18n.js` – kaikki tekstit kolmella kielellä (muokkaa tekstejä täällä)
- `assets/styles.css`, `assets/site.js` – ulkoasu ja vuorovaikutus
- `assets/webgl.js` – WebGL-efektit (Three.js): etusivun kuvan nesteefekti ja kultainen 3D-mitali
- `assets/sound.js` – taustaääni ja käyttöliittymän äänet (Web Audio, oletuksena pois päältä)
- `assets/vendor/` – GSAP (ScrollTrigger, SplitText), Lenis ja Three.js, tallennettu paikallisesti
- `assets/fonts/` – fontit ladataan omalta palvelimelta (ei Google Fonts -yhteyttä)

Sivusto ei tee yhtään pyyntöä ulkopuolisille palvelimille. Animaatiot kytkeytyvät pois, jos käyttäjä on valinnut käyttöjärjestelmästä "vähennä liikettä".

Kieli valitaan automaattisesti selaimen kielen mukaan, ja sen voi vaihtaa ylävalikosta tai linkillä `?lang=fi|en|sv`.

## Muokkaaminen Visual Studio Codessa

1. Avaa koko kansio: *File → Open Folder…* ja valitse sivuston kansio (ei pelkkää yksittäistä tiedostoa).
2. Asenna ehdotettu laajennus **Live Server** (VS Code ehdottaa sitä automaattisesti).
3. Avaa `index.html` ja klikkaa alareunan **Go Live** -painiketta. Sivu aukeaa selaimeen ja päivittyy aina, kun tallennat.

Fontit eivät lataudu, jos `index.html` avataan suoraan tiedostona (`file://`), joten käytä Live Serveriä.

Mistä mitäkin löytyy:

| Haluan muuttaa… | Tiedosto |
| --- | --- |
| Tekstejä (kaikki kielet) | `assets/i18n.js` |
| Sivun rakennetta, osioita, kuvia | `index.html` |
| Värejä, fontteja, kokoja, asettelua | `assets/styles.css` (värit ovat heti alussa `:root`-kohdassa) |
| Animaatioita ja toimintoja | `assets/site.js` |
| WebGL-efektejä, 3D-mitalia | `assets/webgl.js` |
| Ääniä | `assets/sound.js` |
| Tietosuojaselostetta | `assets/i18n.js` (kohta `privacy.body`) |

Julkaisu GitHub Pagesilla: *Settings → Pages → Deploy from a branch* → valitse haara ja `/ (root)`.

Julkaisu Vercelissä: kirjaudu [vercel.com](https://vercel.com)iin GitHub-tunnuksella → *Add New → Project* → valitse tämä repositorio → Framework Preset: **Other** → *Deploy*. Asetuksia ei tarvita. Jos käytät Verceliä, päivitä tietosuojaselosteen kohta "Sivuston ylläpito" (`assets/i18n.js`).

Lisenssit: GSAP – [GreenSock Standard License](https://gsap.com/standard-license) (maksuton), Lenis – MIT (`assets/vendor/LICENSE-lenis.txt`), Three.js – MIT (`assets/vendor/LICENSE-three.txt`), fontit – SIL Open Font License.
