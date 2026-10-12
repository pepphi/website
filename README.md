# Peppi Hietanen – CV-sivusto

Staattinen, interaktiivinen CV-sivusto suomeksi, englanniksi ja ruotsiksi. Ei build-vaihetta – avaa `index.html` selaimessa tai palvele kansio millä tahansa staattisella palvelimella.

- `index.html` – etusivu
- `privacy.html` – tietosuojaseloste
- `assets/i18n.js` – kaikki tekstit kolmella kielellä (muokkaa tekstejä täällä)
- `assets/styles.css`, `assets/site.js` – ulkoasu ja vuorovaikutus
- `assets/vendor/` – GSAP (ScrollTrigger, SplitText) ja Lenis, tallennettu paikallisesti
- `assets/fonts/` – fontit ladataan omalta palvelimelta (ei Google Fonts -yhteyttä)

Sivusto ei tee yhtään pyyntöä ulkopuolisille palvelimille. Animaatiot kytkeytyvät pois, jos käyttäjä on valinnut käyttöjärjestelmästä "vähennä liikettä".

Kieli valitaan automaattisesti selaimen kielen mukaan, ja sen voi vaihtaa ylävalikosta tai linkillä `?lang=fi|en|sv`.

Julkaisu GitHub Pagesilla: *Settings → Pages → Deploy from a branch* → valitse haara ja `/ (root)`.

Lisenssit: GSAP – [GreenSock Standard License](https://gsap.com/standard-license) (maksuton), Lenis – MIT (`assets/vendor/LICENSE-lenis.txt`), fontit – SIL Open Font License.
