# About me — frontend + backend (Node.js + PostgreSQL)

Frontend `public/` ichida, server uni oʻzi beradi. Baza: PostgreSQL (`DATABASE_URL`).

## Render + Neon (bepul) bilan joylash
1. **Baza:** https://neon.tech da akkaunt oching → Create project → “Connection string” ni nusxalang (`postgresql://…`).
   Render’ning oʻz bepul Postgres’ini ishlatmang: u 30 kunda oʻchib ketadi.
2. **GitHub:** yangi repo oching va zip’ni ochib, ichidagi hamma fayl va papkani (package.json, server.js, public/ …) repo’ga yuklang.
3. **Render:** https://render.com → New + → Web Service → repo’ni tanlang.
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: Free
   - Environment:
     - `DATABASE_URL` = Neon’dan nusxalangan matn
     - `JWT_SECRET` = uzun tasodifiy matn
     - `NODE_ENV` = `production`
4. Deploy tugagach, Render bergan `https://…onrender.com` havolasini oching.

(Ixtiyoriy: `render.yaml` Blueprint sifatida ham ishlaydi.)

## Mahalliy ishga tushirish
```bash
npm install
# .env.example ga qarab DATABASE_URL va JWT_SECRET ni oʻrnating
npm start    # http://localhost:3000
```
Jadvallar server birinchi ishga tushganda oʻzi yaratiladi.

## Nimalar server tomonida
- Akkaunt: roʻyxatdan oʻtish/kirish (bcrypt, JWT 60 kun), kirishga tezlik chegarasi
- Profil: bio, shahar, rasm; natijalar: MBTI, IQ, EQ, Enneagram (shakl va oraliq tekshiriladi)
- Umumiy reyting: `GET /api/leaderboard?type=iq|eq`

## Eslatma
- Ballar brauzerda hisoblanadi, server faqat shakl va oraliqni tekshiradi. Soxta ball yuborish mumkin. Jiddiy reyting uchun ballni serverda hisoblash kerak.
- Bepul Render’da sayt 15 daqiqa trafik boʻlmasa uxlaydi, birinchi ochilish sekin boʻladi.
- Frontend `/api/health` javob bermasa, brauzer xotirasida ishlaydigan eski rejimga oʻtadi.
- Ismni oʻzgartirish: `public/app.js` boshidagi `AUTHOR`.
