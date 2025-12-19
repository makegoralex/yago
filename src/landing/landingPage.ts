export const renderLandingPage = (): string => `
  <!doctype html>
  <html lang="ru">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Yago POS — платформа для современной торговли</title>
      <style>
        :root {
          --bg: #0b1221;
          --card: #111a2f;
          --accent: #5ad0ff;
          --text: #e8f0ff;
          --muted: #b7c4e3;
        }

        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
          font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: radial-gradient(circle at 10% 20%, rgba(90, 208, 255, 0.08), transparent 25%),
            radial-gradient(circle at 80% 0%, rgba(160, 120, 255, 0.12), transparent 32%),
            var(--bg);
          color: var(--text);
          min-height: 100vh;
        }

        header {
          max-width: 1100px;
          margin: 0 auto;
          padding: 48px 24px 24px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 20px;
          justify-content: space-between;
        }

        .logo {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          font-weight: 800;
          font-size: 20px;
          letter-spacing: 0.3px;
        }

        .logo-mark {
          width: 42px;
          height: 42px;
          border-radius: 12px;
          background: linear-gradient(135deg, #5ad0ff, #7c7cff);
          display: grid;
          place-items: center;
          font-size: 24px;
          color: #0b1221;
          font-weight: 900;
        }

        .cta-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
        }

        .cta-banner {
          background: linear-gradient(120deg, rgba(90, 208, 255, 0.22), rgba(124, 124, 255, 0.22));
          border: 1px solid rgba(90, 208, 255, 0.4);
          box-shadow: 0 16px 44px rgba(0, 0, 0, 0.35);
          border-radius: 16px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          margin: 0 24px 12px;
        }

        .cta-banner strong {
          font-size: 16px;
        }

        .cta-button {
          padding: 12px 18px;
          border-radius: 12px;
          border: 1px solid rgba(90, 208, 255, 0.5);
          background: linear-gradient(120deg, rgba(90, 208, 255, 0.25), rgba(124, 124, 255, 0.2));
          color: var(--text);
          font-weight: 700;
          text-decoration: none;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .cta-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 38px rgba(90, 208, 255, 0.25);
        }

        .cta-secondary {
          border-color: rgba(255, 255, 255, 0.25);
          background: rgba(255, 255, 255, 0.04);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
        }

        main {
          max-width: 1100px;
          margin: 0 auto;
          padding: 0 24px 48px;
        }

        .hero {
          background: linear-gradient(180deg, rgba(17, 26, 47, 0.92), rgba(17, 26, 47, 0.7));
          border: 1px solid rgba(90, 208, 255, 0.18);
          border-radius: 24px;
          padding: 36px;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
          display: grid;
          gap: 18px;
        }

        .hero h1 {
          margin: 0;
          font-size: clamp(28px, 5vw, 38px);
          line-height: 1.2;
        }

        .hero p {
          margin: 0;
          color: var(--muted);
          font-size: 16px;
          line-height: 1.6;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 14px;
        }

        .metric-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(90, 208, 255, 0.18);
          border-radius: 18px;
          padding: 16px;
        }

        .metric-card .value {
          font-size: 24px;
          font-weight: 800;
        }

        .metric-card .label {
          color: var(--muted);
          font-size: 13px;
          letter-spacing: 0.3px;
        }

        .section-title {
          margin: 38px 0 12px;
          font-size: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .section-title::before {
          content: '';
          width: 12px;
          height: 12px;
          border-radius: 4px;
          background: linear-gradient(135deg, #5ad0ff, #7c7cff);
          box-shadow: 0 0 16px rgba(90, 208, 255, 0.5);
        }

        .features {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }

        .feature-card {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 18px;
          display: grid;
          gap: 8px;
        }

        .feature-card strong {
          font-size: 16px;
        }

        .feature-card span {
          color: var(--muted);
          font-size: 14px;
          line-height: 1.5;
        }

        .footer-note {
          margin-top: 36px;
          color: var(--muted);
          font-size: 13px;
        }

        .signup-card {
          margin-top: 24px;
          background: #0c1426;
          border: 1px solid rgba(90, 208, 255, 0.25);
          border-radius: 18px;
          padding: 18px;
          box-shadow: 0 16px 48px rgba(0, 0, 0, 0.35);
          display: grid;
          gap: 14px;
        }

        .signup-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }

        .signup-card label {
          display: block;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .signup-card input {
          width: 100%;
          padding: 12px;
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.04);
          color: var(--text);
          font-size: 15px;
        }

        .signup-card input:focus {
          outline: none;
          border-color: rgba(90, 208, 255, 0.6);
          box-shadow: 0 0 0 4px rgba(90, 208, 255, 0.18);
        }

        .signup-hint {
          color: var(--muted);
          font-size: 13px;
        }

        .signup-actions {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .status-banner {
          margin-top: 6px;
          padding: 12px;
          border-radius: 12px;
          font-weight: 600;
        }

        .success-banner {
          background: rgba(52, 211, 153, 0.12);
          border: 1px solid rgba(52, 211, 153, 0.4);
          color: #bbf7d0;
        }

        .error-banner {
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.5);
          color: #fecdd3;
        }
      </style>
    </head>
    <body>
      <header>
        <div class="logo" aria-label="Логотип Yago POS">
          <div class="logo-mark">Y</div>
          <div>Yago POS</div>
        </div>
        <div class="cta-row">
          <a class="cta-button" href="#signup">Регистрация</a>
          <a class="cta-button cta-secondary" href="#signup">Создать организацию</a>
        </div>
      </header>
      <div class="cta-banner">
        <div>
          <strong>Регистрация открыта</strong>
          <div style="color: var(--muted); font-size: 14px; margin-top: 4px;">Создайте организацию и получите доступ владельца.</div>
        </div>
        <a class="cta-button" href="#signup">Зарегистрироваться</a>
      </div>
      <main>
        <section class="hero">
          <h1>Ваш бизнес под контролем: POS, склад, лояльность и аналитика в одном окне</h1>
          <p>
            Yago POS — облачная платформа для кафе, магазинов и dark kitchen. Управляйте сменами, меню, скидками и заказами
            без сложных интеграций, а встроенные API позволяют подключать витрины и внешние сервисы.
          </p>
          <div class="metrics">
            <div class="metric-card">
              <div class="value"><span aria-hidden="true">⚡</span> 5 минут</div>
              <div class="label">На развёртывание и запуск точки</div>
            </div>
            <div class="metric-card">
              <div class="value">99.9%</div>
              <div class="label">Доступность облачной инфраструктуры</div>
            </div>
            <div class="metric-card">
              <div class="value">API Ready</div>
              <div class="label">REST + документация на /docs</div>
            </div>
          </div>
        </section>

        <section id="signup" class="signup-card" aria-labelledby="signup-title">
          <div class="cta-row" style="justify-content: space-between; align-items: baseline; gap: 10px;">
            <div>
              <p class="section-title" id="signup-title" style="margin: 0 0 6px;">Самостоятельная регистрация</p>
              <p style="margin: 0; color: var(--muted);">Создайте организацию, чтобы сразу войти под владельцем.</p>
            </div>
            <a class="cta-button" href="#signup">Регистрация</a>
          </div>

          <form id="signup-form" novalidate>
            <div class="signup-grid">
              <div>
                <label for="org-name">Название организации</label>
                <input id="org-name" name="organization" placeholder="Например, Кофе на районе" required />
              </div>
              <div>
                <label for="owner-name">Имя владельца</label>
                <input id="owner-name" name="ownerName" placeholder="Александр" required />
              </div>
              <div>
                <label for="owner-email">Email владельца</label>
                <input id="owner-email" type="email" name="email" placeholder="owner@coffee.ru" required />
              </div>
              <div>
                <label for="owner-password">Пароль</label>
                <input id="owner-password" type="password" name="password" placeholder="Придумайте пароль" required />
              </div>
            </div>
            <div class="signup-actions">
              <button class="cta-button" type="submit">Создать организацию</button>
              <span class="signup-hint">Запрос занимает пару секунд. После создания вы сразу получите доступ владельца.</span>
            </div>
            <div id="signup-result"></div>
          </form>
        </section>

        <h2 class="section-title">Что уже внутри</h2>
        <div class="features" role="list">
          <div class="feature-card" role="listitem">
            <strong>Управление меню и каталогом</strong>
            <span>Категории, модификаторы, остатки и цены с мгновенным обновлением на POS и курьерских витринах.</span>
          </div>
          <div class="feature-card" role="listitem">
            <strong>Заказы и скидки</strong>
            <span>Гибкие правила промо, промокоды, автоматические скидки по времени и персональные предложения.</span>
          </div>
          <div class="feature-card" role="listitem">
            <strong>Склад и поставщики</strong>
            <span>Остатки, инвентаризации, приходные накладные и контроль себестоимости по каждому блюду.</span>
          </div>
          <div class="feature-card" role="listitem">
            <strong>Лояльность и клиенты</strong>
            <span>Баллы, статусы, персональные цены и история покупок в одном профиле гостя.</span>
          </div>
          <div class="feature-card" role="listitem">
            <strong>Смены и кассы</strong>
            <span>Открытие/закрытие смен, кассовая дисциплина и контроль движения наличных.</span>
          </div>
          <div class="feature-card" role="listitem">
            <strong>Отчётность</strong>
            <span>Продажи по часам и категориям, эффективность акций, маржинальность и экспорт данных.</span>
          </div>
        </div>

        <h2 class="section-title">Подключение за день</h2>
        <div class="features" role="list">
          <div class="feature-card" role="listitem">
            <strong>Облачный старт</strong>
            <span>Не требуется своё железо: достаточно браузера или планшета. POS доступен на /pos.</span>
          </div>
          <div class="feature-card" role="listitem">
            <strong>Админ-панель</strong>
            <span>Настройка меню, скидок и пользователей на /admin с ролевой моделью доступа.</span>
          </div>
          <div class="feature-card" role="listitem">
            <strong>Интеграции по API</strong>
            <span>Документация по адресу /docs. Используйте webhooks и REST, чтобы связать доставку и CRM.</span>
          </div>
        </div>

        <p class="footer-note">Готовы попробовать? Напишите нам — подключим пилот за один день и перенесём ваши данные.</p>
      </main>

      <script>
        const form = document.getElementById('signup-form');
        const result = document.getElementById('signup-result');

        form?.addEventListener('submit', async (event) => {
          event.preventDefault();
          result.textContent = '';

          const organization = form.organization?.value?.trim();
          const ownerName = form.ownerName?.value?.trim();
          const email = form.email?.value?.trim();
          const password = form.password?.value;

          if (!organization || !ownerName || !email || !password) {
            result.innerHTML = '<div class="error-banner">Заполните все поля, чтобы продолжить.</div>';
            return;
          }

          form.querySelectorAll('button, input').forEach((element) => {
            element.disabled = true;
          });
          result.innerHTML = '';

          try {
            const response = await fetch('/api/organizations/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: organization,
                owner: { name: ownerName, email, password },
              }),
            });

            if (!response.ok) {
              throw new Error('Не удалось отправить запрос');
            }

            result.innerHTML = '<div class="success-banner">Организация создана! Используйте введённый email и пароль для входа.</div>';
            form.reset();
          } catch (_error) {
            result.innerHTML = '<div class="error-banner">Не получилось зарегистрироваться. Попробуйте ещё раз.</div>';
          } finally {
            form.querySelectorAll('button, input').forEach((element) => {
              element.disabled = false;
            });
          }
        });
      </script>
    </body>
  </html>
`;
