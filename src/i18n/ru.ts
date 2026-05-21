// Russian strings for TaskBot

// ── Helpers ────────────────────────────────────────────────────────────────

export function deadlineLabel(hours: number): string {
  if (hours % 24 === 0) {
    const d = hours / 24;
    return `${d} ${d === 1 ? 'день' : d < 5 ? 'дня' : 'дней'}`;
  }
  return `${hours} ${hours === 1 ? 'час' : hours < 5 ? 'часа' : 'часов'}`;
}

function pluralFiles(n: number): string {
  if (n === 1) return '1 файл';
  if (n < 5) return `${n} файла`;
  return `${n} файлов`;
}

// ── Auth / approvedOnly ────────────────────────────────────────────────────

export const AUTH_NOT_REGISTERED = '⚠️ Используйте /start для регистрации.';
export const AUTH_PENDING = '⏳ Ваша регистрация ожидает подтверждения администратора. Вы получите уведомление после одобрения.';
export const AUTH_REJECTED = '❌ Ваша регистрация отклонена. Свяжитесь с администратором.';
export const AUTH_BANNED = '🚫 Ваш доступ к боту заблокирован. Свяжитесь с администратором.';

// ── Registration ───────────────────────────────────────────────────────────

export const REG_WELCOME_BACK = (firstName: string) =>
  `С возвращением, <b>${firstName}</b>! 👋\n\nИспользуйте меню ниже.`;

export const REG_PENDING = '⏳ Ваша регистрация ожидает подтверждения администратора. Вы получите уведомление после одобрения.';
export const REG_REJECTED = '❌ Ваша регистрация отклонена. Свяжитесь с администратором.';

export const REG_START =
  `👋 <b>Добро пожаловать в TaskBot!</b>\n\n` +
  `Для регистрации нужен хотя бы один способ оплаты.\n\n` +
  `<b>Шаг 1/2:</b> Введите ваш <b>Binance Pay ID</b>:\n` +
  `<i>(9-значное число из Binance → Pay → Получить)</i>`;

export const REG_STEP1_BINANCE =
  `<b>Шаг 1/2:</b> Введите ваш <b>Binance Pay ID</b>:\n` +
  `<i>(9-значное число из Binance → Pay → Получить)</i>`;

export const REG_STEP2_CARD =
  `<b>Шаг 2/2:</b> Введите номер вашей <b>банковской карты</b> (16 цифр):\n` +
  `<i>(пробелы допускаются, напр. 1234 5678 9012 3456)</i>`;

export const REG_INVALID_CARD = '❌ Неверный номер карты. Введите ровно 16 цифр (пробелы допускаются):';

export const REG_MUST_PROVIDE_PAYMENT =
  `❌ Необходимо указать хотя бы один способ оплаты.\n\n` +
  `<b>Шаг 1/2:</b> Введите ваш <b>Binance Pay ID</b>:`;

export const REG_SUBMITTED =
  `✅ <b>Заявка отправлена!</b>\n\n` +
  `Администратор рассмотрит вашу заявку. Вы получите уведомление после одобрения.`;

export const REG_ADMIN_NEW_USER = (userName: string, telegramId: string, paymentLines: string) =>
  `🆕 <b>Новая регистрация</b>\n\n` +
  `Пользователь: ${userName}\n` +
  `Telegram ID: <code>${telegramId}</code>\n` +
  `${paymentLines}`;

export const REG_APPROVED_NOTIFY = '🎉 <b>Регистрация одобрена!</b>\n\nВы можете пользоваться ботом. Введите /start.';
export const REG_REJECTED_NOTIFY = '❌ Ваша регистрация отклонена. Свяжитесь с администратором для подробностей.';

// ── Admin panel ────────────────────────────────────────────────────────────

export const ADMIN_PANEL_HEADER = '<b>🔧 Панель администратора</b>\n\nЧем хотите управлять?';
export const ADMIN_TASK_CREATION_CANCELLED = '<b>🔧 Панель администратора</b>\n\nСоздание задания отменено.';

// ── Admin users ────────────────────────────────────────────────────────────

export const ADMIN_NO_PENDING_USERS = '✅ Нет заявок на регистрацию.';
export const ADMIN_PENDING_USERS_HEADER = (count: number) =>
  `👥 <b>Ожидающие подтверждения</b> — ${count}`;
export const ADMIN_USER_NO_PAYMENT = '<i>Нет платёжных данных</i>';
export const ADMIN_USER_APPROVED = (name: string) => `✅ <b>Одобрен:</b> ${name}`;
export const ADMIN_USER_REJECTED = (name: string) => `❌ <b>Отклонён:</b> ${name}`;
export const ADMIN_USER_ALREADY_HANDLED = (resultText: string) => `${resultText}\n\n<i>Обработано другим администратором</i>`;
export const ADMIN_USER_NOT_FOUND = '❌ Пользователь не найден';
export const ADMIN_BAN_USAGE = 'Использование: /ban <telegram_id>\n\nПример: /ban 123456789';
export const ADMIN_BAN_NOT_FOUND = (id: string) =>
  `❌ Пользователь с Telegram ID <code>${id}</code> не найден.`;
export const ADMIN_BANNED = (name: string) => `🚫 <b>${name}</b> заблокирован.`;
export const ADMIN_BAN_NOTIFY = '🚫 Ваш доступ к боту заблокирован администратором.';

export const ADMIN_UNBAN_USAGE = 'Использование: /unban <telegram_id>\n\nПример: /unban 123456789';
export const ADMIN_UNBAN_NOT_FOUND = (id: string) =>
  `❌ Пользователь с Telegram ID <code>${id}</code> не найден.`;
export const ADMIN_UNBANNED = (name: string) => `✅ <b>${name}</b> разблокирован и одобрен.`;

export const ADMIN_PROMOTE_USAGE = 'Использование: /promote <telegram_id>\n\nПример: /promote 123456789';
export const ADMIN_PROMOTE_NOT_FOUND = (id: string) =>
  `❌ Пользователь с Telegram ID <code>${id}</code> не найден.\n\nПримечание: пользователь должен быть зарегистрирован.`;
export const ADMIN_PROMOTED = (name: string) => `👑 <b>${name}</b> теперь администратор.`;

// ── Admin tasks ────────────────────────────────────────────────────────────

export const TASK_CATEGORY_LABELS: Record<string, string> = {
  report_app: '📊 Репорт приложения',
  download_app: '📥 Скачать приложение',
  install_by_key: '🔑 Установка приложения по ключу',
};

export const CATEGORY_KEY_LABELS: Record<string, string> = {
  report_app: '📊 Репорт приложения',
  download_app: '📥 Скачать приложение',
  install_by_key: '🔑 Установка приложения по ключу',
  none: '📋 Без категории',
};

export const ADMIN_NO_TASKS = '📋 Заданий пока нет.';
export const ADMIN_TASKS_HEADER = (count: number) => `📋 <b>Все задания</b> (${count})`;
export const ADMIN_TASKS_NO_RESULTS = (label: string) =>
  `📋 <b>Задания</b>\n\n<i>В категории «${label}» заданий нет.</i>`;
export const ADMIN_TASK_NOT_FOUND = '❌ Задание не найдено';
export const ADMIN_TASK_ACTIVE_STATUS = '🟢 Активно';
export const ADMIN_TASK_INACTIVE_STATUS = '🔴 Неактивно';
export const ADMIN_TASK_ACTIVATED = '🟢 Задание активировано';
export const ADMIN_TASK_DEACTIVATED = '🔴 Задание деактивировано';

export const ADMIN_TASK_DETAIL = (
  title: string,
  description: string | null | undefined,
  link: string,
  priceUah: string,
  slotsAvailable: number,
  slotsTotal: number,
  dl: string,
  status: string,
  expiresAt?: string | null,
  categoryLabel?: string | null,
  packageName?: string | null,
) =>
  `<b>${title}</b>\n\n` +
  (categoryLabel ? `📂 Категория: <b>${categoryLabel}</b>\n` : '') +
  (packageName ? `📦 Пакет: <code>${packageName}</code>\n` : '') +
  (description ? `📝 ${description}\n\n` : '') +
  `🔗 <a href="${link}">Ссылка на задание</a>\n` +
  `💰 Оплата: <b>${priceUah} грн</b>\n` +
  `👥 Места: ${slotsAvailable}/${slotsTotal}\n` +
  `⏰ Дедлайн пользователя: <b>${dl}</b>\n` +
  (expiresAt ? `📅 Задание закрывается: <b>${expiresAt}</b>\n` : '') +
  `Статус: ${status}`;

export const ADMIN_TASK_DELETE_CONFIRM = (title: string) =>
  `🗑 <b>Удалить задание?</b>\n\n"${title}"\n\nЭто действие необратимо.`;
export const ADMIN_TASK_DELETED = '🗑 Задание удалено';
export const ADMIN_TASK_HAS_ACTIVE_ASSIGNMENTS = (count: number) =>
  `❌ ${count} пользователь(ей) активно работает над этим заданием. Деактивируйте его и дождитесь завершения (до 24 ч.).`;

// Task creation
export const ADMIN_TASK_CREATE_CATEGORY_STEP =
  `➕ <b>Новое задание</b>\n\nВыберите <b>категорию</b> задания:`;

export const ADMIN_TASK_PACKAGE_NAME_STEP =
  `✅ Категория выбрана.\n\n` +
  `Введите <b>название пакета (bundle ID)</b> приложения:\n` +
  `<i>Например: com.example.app</i>`;

export const ADMIN_TASK_PACKAGE_NAME_SAVED = (pkg: string) =>
  `✅ Пакет: <b>${pkg}</b>\n\n` +
  `<b>Шаг 1/7:</b> Введите <b>название</b> задания:\n<i>(не более 100 символов)</i>`;

export const ADMIN_TASK_PACKAGE_NAME_TOO_LONG =
  '❌ Название пакета слишком длинное (макс. 200 символов). Попробуйте ещё раз:';

export const ADMIN_TASK_CREATE_STEP1 =
  `➕ <b>Новое задание — Шаг 1/7</b>\n\nВведите <b>название</b> задания:\n<i>(не более 100 символов)</i>`;

export const ADMIN_TASK_CREATE_STEP3 =
  `<b>Шаг 3/7:</b> Введите <b>ссылку</b> на задание (URL):`;

export const ADMIN_TASK_TITLE_SAVED = (title: string) =>
  `✅ Название: <b>${title}</b>\n\n<b>Шаг 2/7:</b> Введите описание:\n<i>(необязательно, не более 500 символов)</i>`;

export const ADMIN_TASK_DESC_SAVED =
  `✅ Описание сохранено.\n\n<b>Шаг 3/7:</b> Введите <b>ссылку</b> на задание (URL):`;

export const ADMIN_TASK_LINK_SAVED =
  `✅ Ссылка сохранена.\n\n<b>Шаг 4/7:</b> Введите <b>сумму оплаты</b> в гривнах:\n<i>(например: 50 или 75.50)</i>`;

export const ADMIN_TASK_PRICE_SAVED = (price: string) =>
  `✅ Оплата: <b>${price} грн</b>\n\n<b>Шаг 5/7:</b> Введите количество <b>доступных мест</b>:\n<i>(сколько пользователей могут взять это задание)</i>`;

export const ADMIN_TASK_SLOTS_SAVED = (slots: string) =>
  `✅ Мест: <b>${slots}</b>\n\n<b>Шаг 6/7:</b> Введите <b>дедлайн пользователя</b> в часах:\n<i>(сколько времени есть у пользователя после получения задания, напр. 1, 24, 48)</i>`;

export const ADMIN_TASK_DEADLINE_SAVED = (dl: string) =>
  `✅ Дедлайн пользователя: <b>${dl}</b>\n\n<b>Шаг 7/7:</b> Введите <b>срок действия задания</b> в часах:\n<i>(через сколько часов задание закроется для новых участников, напр. 48, 72)</i>\n<i>Пропустите, если задание бессрочное.</i>`;

export const ADMIN_TASK_EXPIRY_STEP =
  `<b>Шаг 7/7:</b> Введите <b>срок действия задания</b> в часах:\n<i>(через сколько часов задание закроется для новых участников)</i>\n<i>Пропустите, если задание бессрочное.</i>`;

export const ADMIN_TASK_INVALID_EXPIRY = '❌ Неверное значение. Введите количество часов от 1 до 8760 (1 год):';

export const ADMIN_TASK_TITLE_TOO_LONG = '❌ Название слишком длинное (макс. 100 символов). Попробуйте ещё раз:';
export const ADMIN_TASK_DESC_TOO_LONG = '❌ Описание слишком длинное (макс. 500 символов). Попробуйте ещё раз:';
export const ADMIN_TASK_INVALID_URL = '❌ Неверный URL. Должен начинаться с http:// или https://. Попробуйте ещё раз:';
export const ADMIN_TASK_INVALID_PRICE = '❌ Неверная сумма. Введите положительное число (напр. 50 или 75.50):';
export const ADMIN_TASK_INVALID_SLOTS = '❌ Неверное число. Введите положительное целое число (макс. 1000):';
export const ADMIN_TASK_INVALID_DEADLINE = '❌ Неверное значение. Введите количество часов от 1 до 720:';
export const ADMIN_TASK_INCOMPLETE = '❌ Данные задания неполны. Начните заново.';

export const ADMIN_TASK_SUMMARY = (
  title: string,
  description: string | undefined,
  link: string,
  priceUah: string,
  slotsTotal: number,
  dl: string,
  expiryLabel?: string | null,
  categoryLabel?: string | null,
  packageName?: string | null,
) =>
  `📋 <b>Итог задания</b>\n\n` +
  (categoryLabel ? `Категория: <b>${categoryLabel}</b>\n` : '') +
  (packageName ? `Пакет: <code>${packageName}</code>\n` : '') +
  `Название: <b>${title}</b>\n` +
  (description ? `Описание: ${description}\n` : '') +
  `Ссылка: <a href="${link}">${link}</a>\n` +
  `Оплата: <b>${priceUah} грн</b>\n` +
  `Мест: <b>${slotsTotal}</b>\n` +
  `Дедлайн пользователя: <b>${dl}</b>\n` +
  (expiryLabel ? `Срок действия: <b>${expiryLabel}</b>\n` : `Срок действия: <i>бессрочно</i>\n`) +
  `\nСоздать задание?`;

export const ADMIN_TASK_CREATED = (title: string, priceUah: string, slotsTotal: number) =>
  `✅ <b>Задание создано!</b>\n\n<b>${title}</b>\n💰 ${priceUah} грн | 👥 ${slotsTotal} мест`;

export const NEW_TASK_NOTIFY = (title: string, priceUah: string) =>
  `🆕 <b>Новое задание!</b>\n\n<b>${title}</b>\n💰 ${priceUah} грн\n\nОткройте раздел «Задания», чтобы взять его.`;

// ── Admin reports ──────────────────────────────────────────────────────────

export const ADMIN_NO_PENDING_REPORTS = '✅ Нет отчётов на проверке.';
export const ADMIN_REPORTS_HEADER = (count: number) => `📊 <b>Отчёты на проверке</b> (${count})`;
export const ADMIN_USER_REPORTS_HEADER = (userName: string, count: number) =>
  `👤 <b>${userName}</b> — ${count} отч. на проверке`;
export const ADMIN_BULK_APPROVED = (count: number) => `✅ Одобрено ${count} отчётов.`;
export const ADMIN_REPORT_NOT_FOUND = '❌ Отчёт не найден';
export const ADMIN_REPORT_ALREADY_REVIEWED = '❌ Отчёт не найден или уже проверен';

export const ADMIN_REPORT_DETAIL = (
  reportId: number,
  taskTitle: string,
  userName: string,
  priceUah: string,
  submittedAt: string,
  fileCount: number,
  packageName?: string | null,
) =>
  `📊 <b>Отчёт #${reportId}</b>\n\n` +
  `Задание: <b>${taskTitle}</b>\n` +
  (packageName ? `Пакет: <code>${packageName}</code>\n` : '') +
  `Пользователь: ${userName}\n` +
  `Вознаграждение: <b>${priceUah} грн</b>\n` +
  `Отправлен: ${submittedAt}\n` +
  `Файлы: ${pluralFiles(fileCount)}\n\n` +
  `<i>Файлы будут отправлены ниже. Используйте кнопки для одобрения или отклонения.</i>`;

export const ADMIN_REPORT_APPROVED_LABEL = '✅ Отчёт одобрен!';
export const ADMIN_REPORT_APPROVED_TEXT = (
  reportId: number,
  taskTitle: string,
  userTelegramId: string,
  priceUah: string,
  newBalance: string,
) =>
  `✅ <b>Отчёт #${reportId} одобрен</b>\n\n` +
  `Задание: ${taskTitle}\n` +
  `Пользователь: ${userTelegramId}\n` +
  `+${priceUah} грн начислено | Баланс: ${newBalance} грн`;

export const ADMIN_REPORT_APPROVED_NOTIFY = (taskTitle: string, priceUah: string, newBalance: string) =>
  `🎉 <b>Отчёт одобрен!</b>\n\n` +
  `Задание: <b>${taskTitle}</b>\n` +
  `Вознаграждение: <b>+${priceUah} грн</b>\n` +
  `Баланс: <b>${newBalance} грн</b>`;

export const ADMIN_REPORT_REJECT_ASK = (reportId: number) =>
  `❌ <b>Отклонить отчёт #${reportId}</b>\n\n` +
  `Напишите причину (необязательно) или нажмите <b>Пропустить</b>, чтобы отклонить без комментария.`;

export const ADMIN_REPORT_REJECTED_LABEL = '❌ Отчёт отклонён';
export const ADMIN_REPORT_REJECTED_TEXT = (reportId: number, comment?: string) =>
  `❌ <b>Отчёт #${reportId} отклонён</b>\n` +
  (comment ? `Причина: ${comment}` : '<i>Причина не указана.</i>');

export const ADMIN_REPORT_REJECTED_NOTIFY = (taskTitle: string, comment?: string) =>
  `❌ <b>Отчёт отклонён</b>\n\n` +
  `Задание: <b>${taskTitle}</b>\n` +
  (comment ? `Причина: ${comment}` : '<i>Причина не указана.</i>') +
  `\n\nЕсли задание ещё активно и есть свободные места — вы можете взять его повторно и отправить новый отчёт.`;

// ── Admin report examples ──────────────────────────────────────────────────

export const ADMIN_REX_LIST_HEADER =
  `📝 <b>Примеры отчётов</b>\n\nВыберите тип задания для управления примером:`;

export const ADMIN_REX_NO_EXAMPLE = (label: string) =>
  `📝 <b>Пример отчёта — ${label}</b>\n\n<i>Пример не задан.</i>`;

export const ADMIN_REX_DETAIL = (
  label: string,
  comment: string | null,
  mediaCount: number,
) =>
  `📝 <b>Пример отчёта — ${label}</b>\n\n` +
  `Комментарий: ${comment ? `<i>${comment}</i>` : '<i>не задан</i>'}\n` +
  `Медиафайлов: <b>${mediaCount}</b>`;

export const ADMIN_REX_CREATED = '✅ Пример создан.';

export const ADMIN_REX_COMMENT_PROMPT = (currentComment: string | null) =>
  `✏️ <b>Комментарий к примеру</b>\n\n` +
  `Текущий: ${currentComment ? `<i>${currentComment}</i>` : '<i>не задан</i>'}\n\n` +
  `Введите новый текст комментария:`;

export const ADMIN_REX_COMMENT_SAVED = '✅ Комментарий сохранён.';

export const ADMIN_REX_DELETE_CONFIRM = (label: string) =>
  `🗑 <b>Удалить пример отчёта?</b>\n\n${label}\n\nМедиафайлы также будут удалены. Это действие необратимо.`;

export const ADMIN_REX_DELETED = '🗑 Пример удалён.';

export const ADMIN_REX_MEDIA_HEADER = (label: string, count: number) =>
  `📎 <b>Медиа примера — ${label}</b>\n\n` +
  (count === 0 ? `Нет файлов. Добавьте фото или видео.` : `${pluralFiles(count)} прикреплено.`);

export const ADMIN_REX_MEDIA_UPLOAD_PROMPT = (label: string, max: number, count: number) =>
  `📎 <b>Добавить медиа — ${label}</b>\n\n` +
  `Отправьте фото или видео (до ${max} файлов, макс. 20 МБ каждый).\n\n` +
  `Получено файлов: <b>${count}</b>`;

export const ADMIN_REX_MEDIA_SAVED = '✅ Медиафайлы сохранены.';
export const ADMIN_REX_MEDIA_CLEARED = '🗑 Медиафайлы удалены.';
export const ADMIN_REX_MEDIA_CLEAR_CONFIRM =
  `🗑 <b>Удалить все медиафайлы примера?</b>\n\nЭто действие необратимо.`;

// ── User report example display ────────────────────────────────────────────

export const USER_REPORT_EXAMPLE_HEADER = (comment: string | null) =>
  `📋 <b>Пример отчёта:</b>` + (comment ? `\n\n${comment}` : '');

// ── Admin payouts ──────────────────────────────────────────────────────────

export const ADMIN_PAYOUT_EMPTY = (threshold: number) =>
  `💰 <b>Очередь выплат</b>\n\nНет пользователей, достигших порога ${threshold} грн.`;

export const ADMIN_PAYOUT_QUEUE_HEADER = (count: number, threshold: number) =>
  `💰 <b>Очередь выплат</b> (${count})\n\n` +
  `Эти пользователи достигли порога ${threshold} грн и ожидают выплаты.`;

export const ADMIN_PAYOUT_USER_NOT_FOUND = '❌ Пользователь не найден или больше не соответствует критериям';
export const ADMIN_PAYOUT_NO_LONGER_ELIGIBLE = '❌ Пользователь больше не соответствует критериям';

export const ADMIN_PAYOUT_DETAIL = (
  name: string,
  telegramId: string,
  balance: string,
  paymentLines: string,
  taskLines: string,
) =>
  `👤 <b>${name}</b>\n` +
  `Telegram ID: <code>${telegramId}</code>\n\n` +
  `💰 К выплате: <b>${balance} грн</b>\n\n` +
  `<b>Способы оплаты:</b>\n${paymentLines || '<i>Нет данных</i>'}\n\n` +
  `<b>Выполненные задания (текущий цикл):</b>\n${taskLines}`;

export const ADMIN_PAYOUT_NO_TASK_DETAILS = '<i>Нет данных о заданиях.</i>';

export const ADMIN_PAYOUT_CONFIRM = (name: string, balance: string) =>
  `⚠️ <b>Подтвердить выплату</b>\n\n` +
  `Пользователь: <b>${name}</b>\n` +
  `Сумма: <b>${balance} грн</b>\n\n` +
  `Вы уже отправили оплату вне бота?\n` +
  `Нажатие «Подтвердить» обнулит баланс пользователя.`;

export const ADMIN_PAYOUT_FAILED = '❌ Ошибка выплаты — пользователь может больше не соответствовать критериям';
export const ADMIN_PAYOUT_RECORDED_LABEL = '✅ Выплата зарегистрирована!';
export const ADMIN_PAYOUT_RECORDED_TEXT = (payoutId: number, userName: string, amount: string) =>
  `✅ <b>Выплата #${payoutId} зарегистрирована</b>\n\n` +
  `Пользователь: ${userName}\n` +
  `Сумма: <b>${amount} грн</b>\n` +
  `Баланс обнулён.`;

export const ADMIN_PAYOUT_NOTIFY = (amount: string) =>
  `💸 <b>Оплата отправлена!</b>\n\n` +
  `Вы получили <b>${amount} грн</b>.\n` +
  `Ваш баланс обнулён.\n\n` +
  `Выполняйте задания, чтобы зарабатывать больше!`;

export const ADMIN_PAYOUT_SHOW_CARD = (formatted: string) =>
  `🔓 <b>Полный номер карты</b>\n\n<code>${formatted}</code>\n\n⚠️ Сообщение будет удалено через 60 секунд.`;

export const ADMIN_PAYOUT_NO_CARD = 'Карта не указана';

export const ADMIN_PAYOUT_PROOF_PROMPT = (name: string, amount: string) =>
  `📎 <b>Подтверждение выплаты</b>\n\n` +
  `Пользователь: <b>${name}</b>\n` +
  `Сумма: <b>${amount} грн</b>\n\n` +
  `Отправьте скриншот подтверждения платежа или нажмите <b>Пропустить</b>:`;

export const ADMIN_PAYOUT_NOTIFY_WITH_PROOF = (amount: string) =>
  `💸 <b>Оплата отправлена!</b>\n\n` +
  `Вы получили <b>${amount} грн</b>.\n` +
  `Ваш баланс обнулён.\n\n` +
  `Выполняйте задания, чтобы зарабатывать больше!`;

// ── Admin task media ───────────────────────────────────────────────────────

export const ADMIN_TASK_MEDIA_HEADER = (title: string, fileCount: number) =>
  `📎 <b>Вспомогательные материалы — ${title}</b>\n\n` +
  (fileCount === 0
    ? `Нет материалов. Добавьте фото или видео.`
    : `${pluralFiles(fileCount)} прикреплено.`);

export const ADMIN_TASK_MEDIA_UPLOAD_PROMPT = (title: string, max: number, count: number) =>
  `📎 <b>Добавить материалы — ${title}</b>\n\n` +
  `Отправьте фото или видео (до ${max} файлов, макс. 20 МБ каждый).\n\n` +
  `Получено файлов: <b>${count}</b>`;

export const ADMIN_TASK_MEDIA_ADDED = (type: 'photo' | 'video', count: number, max: number) =>
  `✅ ${type === 'photo' ? 'Фото' : 'Видео'} добавлено (${count}/${max}).`;
export const ADMIN_TASK_MEDIA_MAX_FILES = (max: number) => `❌ Максимум ${max} файлов на задание.`;
export const ADMIN_TASK_MEDIA_TOO_LARGE = '❌ Файл слишком большой (макс. 20 МБ).';
export const ADMIN_TASK_MEDIA_UPLOAD_FAILED = '❌ Ошибка загрузки. Попробуйте ещё раз.';
export const ADMIN_TASK_MEDIA_SAVED = '✅ Материалы сохранены';
export const ADMIN_TASK_MEDIA_NO_FILES_PREVIEW = 'Нет файлов для предпросмотра';
export const ADMIN_TASK_MEDIA_CLEAR_CONFIRM =
  `🗑 <b>Удалить все материалы?</b>\n\nЭто действие необратимо.`;
export const ADMIN_TASK_MEDIA_CLEARED = '🗑 Материалы удалены';
export const ADMIN_TASK_MEDIA_DONE_BTN = (count: number) =>
  count === 0 ? '✅ Готово' : `✅ Готово (${pluralFiles(count)})`;

// ── User tasks ─────────────────────────────────────────────────────────────

export const USER_NO_TASKS = '📋 Нет доступных заданий. Загляните позже!';
export const USER_NO_TASKS_IN_CATEGORY = (label: string) =>
  `📋 <b>Доступные задания</b>\n\n<i>В категории «${label}» доступных заданий нет.</i>`;
export const USER_TASKS_HEADER = (count: number) => `📋 <b>Доступные задания</b> (${count})`;
export const USER_TASKS_FOOTER = '<i>Выберите задание для подробностей.</i>';
export const USER_TASK_UNAVAILABLE = '❌ Это задание больше недоступно.';

export const USER_TASK_DETAIL = (
  title: string,
  description: string | null | undefined,
  link: string,
  priceUah: string,
  slotsAvailable: number,
  dl: string,
  alreadyClaimed: boolean,
  packageName?: string | null,
) =>
  `<b>${title}</b>\n\n` +
  (description ? `${description}\n\n` : '') +
  `🔗 <a href="${link}">Открыть задание</a>\n` +
  `💰 Вознаграждение: <b>${priceUah} грн</b>\n` +
  `👥 Доступных мест: <b>${slotsAvailable}</b>\n` +
  `⏰ Дедлайн после получения: <b>${dl}</b>\n` +
  (packageName ? `📦 Пакет: <code>${packageName}</code>` : '') +
  (alreadyClaimed ? '\n\n✅ <i>Вы уже взяли это задание.</i>' : '');

export const USER_TASK_ALREADY_CLAIMED = '✅ Вы уже взяли это задание.';
export const USER_TASK_NO_SLOTS = '❌ Свободных мест больше нет.';
export const USER_TASK_CLAIMED_LABEL = '✅ Задание получено!';

export const USER_TASK_CLAIMED_TEXT = (title: string | undefined, deadline: string) =>
  `✅ <b>Задание получено!</b>\n\n` +
  `<b>${title}</b>\n\n` +
  `Выполните задание и отправьте отчёт до истечения срока.\n` +
  `⏰ Дедлайн: <b>${deadline}</b>\n\n` +
  `Перейдите в <b>Мои задания</b>, чтобы отправить отчёт.`;

export const USER_MY_TASKS_EMPTY = `🎯 <b>Мои задания</b>\n\nВы ещё не взяли ни одного задания.`;
export const USER_MY_TASKS_HEADER = (count: number) => `🎯 <b>Мои задания</b> (${count})`;

export const TASK_STATUS_RU: Record<string, string> = {
  claimed: 'получено',
  completed: 'выполнено',
  expired: 'просрочено',
};

export const TASK_STATUS_EMOJI: Record<string, string> = {
  claimed: '⏳',
  completed: '✅',
  expired: '❌',
};

export const USER_ASSIGNMENT_DETAIL = (
  title: string,
  description: string | null | undefined,
  link: string,
  priceUah: string,
  deadline: string,
  statusEmoji: string,
  status: string,
  packageName?: string | null,
) =>
  `<b>${title}</b>\n\n` +
  (description ? `📝 ${description}\n\n` : '') +
  `🔗 <a href="${link}">Открыть задание</a>\n` +
  `💰 Вознаграждение: <b>${priceUah} грн</b>\n` +
  `⏰ Дедлайн: <b>${deadline}</b>\n` +
  (packageName ? `📦 Пакет: <code>${packageName}</code>\n` : '') +
  `Статус: ${statusEmoji} <b>${status}</b>`;

export const USER_TASK_HELP_NO_FILES = 'Нет вспомогательных материалов';

// ── User reports ───────────────────────────────────────────────────────────

export const USER_REPORT_ASSIGNMENT_NOT_FOUND = '❌ Задание не найдено.';
export const USER_REPORT_ALREADY_SUBMITTED = '⏳ Вы уже отправили отчёт по этому заданию. Ожидайте проверки администратором.';
export const USER_REPORT_WRONG_STATUS = (status: string) =>
  `❌ Задание уже имеет статус: <b>${status}</b>.\n\nОтчёт можно отправить только для активных заданий.`;

export const USER_REPORT_START_PROMPT = (title: string, maxFiles: number, count: number) =>
  `📎 <b>Отправка отчёта — ${title}</b>\n\n` +
  `Отправьте фото или видео как доказательство (до ${maxFiles} файлов, макс. 20 МБ каждый).\n\n` +
  `Получено файлов: <b>${count}</b>`;

export const USER_REPORT_FILE_TOO_LARGE = '❌ Файл слишком большой (макс. 20 МБ). Сожмите его и попробуйте снова.';
export const USER_REPORT_VIDEO_TOO_LARGE = '❌ Файл слишком большой (макс. 20 МБ). Сожмите видео и попробуйте снова.';
export const USER_REPORT_MAX_FILES = (max: number) => `❌ Максимум ${max} файлов на отчёт.`;
export const USER_REPORT_RETRIEVE_FAILED = '❌ Не удалось получить файл из Telegram. Попробуйте ещё раз.';
export const USER_REPORT_UPLOAD_FAILED = '❌ Ошибка загрузки. Попробуйте ещё раз.';
export const USER_REPORT_PHOTO_RECEIVED = (count: number, max: number) =>
  `✅ Фото получено (${count}/${max}).`;
export const USER_REPORT_VIDEO_RECEIVED = (count: number, max: number) =>
  `✅ Видео получено (${count}/${max}).`;
export const USER_REPORT_SUBMIT_BTN = (count: number) =>
  `✅ Отправить отчёт (${pluralFiles(count)})`;
export const USER_REPORT_NO_FILES = '❌ Сначала отправьте хотя бы одно фото или видео.';
export const USER_REPORT_CANCEL_LABEL = 'Отменено';
export const USER_REPORT_CANCELLED = '❌ Отправка отчёта отменена.';

export const USER_REPORT_SUBMITTED = (title: string) =>
  `✅ <b>Отчёт отправлен!</b>\n\n` +
  `Ваш отчёт по заданию <b>${title}</b> находится на проверке.\n` +
  `Вы получите уведомление, когда администратор одобрит или отклонит его.`;

export const USER_REPORT_ADMIN_NOTIFY = (
  reportId: number,
  taskTitle: string,
  userName: string,
  fileCount: number,
) =>
  `📊 <b>Новый отчёт #${reportId}</b>\n\n` +
  `Задание: <b>${taskTitle}</b>\n` +
  `Пользователь: ${userName}\n` +
  `Файлы: ${pluralFiles(fileCount)}`;

export const USER_MY_REPORTS_EMPTY = `📊 <b>Мои отчёты</b>\n\nВы ещё не отправляли отчётов.`;
export const USER_MY_REPORTS_HEADER = (count: number) => `📊 <b>Мои отчёты</b> (${count})`;

export const REPORT_STATUS_RU: Record<string, string> = {
  pending: 'на проверке',
  approved: 'одобрен',
  rejected: 'отклонён',
};

export const REPORT_STATUS_EMOJI: Record<string, string> = {
  pending: '⏳',
  approved: '✅',
  rejected: '❌',
};

export const USER_REPORT_DETAIL = (
  emoji: string,
  taskTitle: string,
  statusRu: string,
  submittedDate: string,
  priceUah: string,
) =>
  `${emoji} <b>Отчёт — ${taskTitle}</b>\n\n` +
  `Статус: <b>${statusRu}</b>\n` +
  `Отправлен: ${submittedDate}\n` +
  `Вознаграждение: <b>${priceUah} грн</b>`;

export const USER_REPORT_ADMIN_COMMENT = (comment: string) =>
  `\n\n💬 <b>Комментарий администратора:</b>\n${comment}`;

export const USER_REPORT_APPROVED_HINT = (threshold: number) =>
  `\n\n✅ <i>Оплата будет произведена, когда ваш баланс достигнет ${threshold} грн.</i>`;

// ── Payment proofs gallery ─────────────────────────────────────────────────

export const ADMIN_PROOFS_HEADER = (count: number) =>
  `📸 <b>Доказательства выплат</b>\n\n` +
  (count === 0
    ? `Скриншотов пока нет.`
    : `Загружено скриншотов: <b>${count}</b>`);

export const ADMIN_PROOFS_UPLOAD_PROMPT = (count: number) =>
  `📸 <b>Загрузка скриншотов</b>\n\n` +
  `Отправьте фото (скриншоты подтверждений платежей).\n\n` +
  `Загружено: <b>${count}</b>`;

export const ADMIN_PROOFS_ADDED = '✅ Скриншот добавлен.';
export const ADMIN_PROOFS_SAVED = '✅ Скриншоты сохранены.';
export const ADMIN_PROOFS_UPLOAD_FAILED = '❌ Ошибка загрузки. Попробуйте ещё раз.';

export const ADMIN_PROOFS_CLEAR_CONFIRM =
  `🗑 <b>Удалить все скриншоты?</b>\n\nЭто действие необратимо.`;

export const ADMIN_PROOFS_CLEARED = '🗑 Все скриншоты удалены.';

export const USER_PROOFS_EMPTY =
  `📸 <b>Доказательства выплат</b>\n\n<i>Пока нет загруженных скриншотов.</i>`;

export const USER_PROOFS_HEADER = (count: number) =>
  `📸 <b>Доказательства выплат</b>\n\n` +
  `Скриншотов: <b>${count}</b>\n\n` +
  `<i>Скриншоты подтверждений оплат от администраторов:</i>`;

// ── User profile ───────────────────────────────────────────────────────────

export const USER_PROFILE_HEADER = (binanceId: string | null, maskedCard: string | null) =>
  `👤 <b>Мой профиль</b>\n\n` +
  `<b>Способы оплаты:</b>\n` +
  `Binance ID: ${binanceId ? `<code>${binanceId}</code>` : '<i>не указан</i>'}\n` +
  `Карта: ${maskedCard ? `<code>${maskedCard}</code>` : '<i>не указана</i>'}`;

export const USER_PROFILE_BINANCE_PROMPT =
  `✏️ <b>Изменить Binance Pay ID</b>\n\n` +
  `Введите новый <b>Binance Pay ID</b>:\n` +
  `<i>(9-значное число из Binance → Pay → Получить)</i>`;

export const USER_PROFILE_CARD_PROMPT =
  `✏️ <b>Изменить номер карты</b>\n\n` +
  `Введите новый <b>номер карты</b> (16 цифр):\n` +
  `<i>(пробелы допускаются, напр. 1234 5678 9012 3456)</i>`;

export const USER_PROFILE_BINANCE_SAVED = (binanceId: string) =>
  `✅ <b>Binance ID обновлён</b>\n\nНовый ID: <code>${binanceId}</code>`;

export const USER_PROFILE_CARD_SAVED = (maskedCard: string) =>
  `✅ <b>Номер карты обновлён</b>\n\nКарта: <code>${maskedCard}</code>`;

export const USER_PROFILE_INVALID_CARD =
  '❌ Неверный номер карты. Введите ровно 16 цифр (пробелы допускаются):';

// ── Admin task search ───────────────────────────────────────────────────────

export const ADMIN_TASK_SEARCH_PROMPT =
  `🔍 <b>Поиск по пакету</b>\n\nВведите название пакета (bundle ID) или его часть:`;

export const ADMIN_TASK_SEARCH_RESULTS = (query: string, count: number) =>
  `🔍 <b>Результаты поиска</b>\n\nПакет: <code>${query}</code>\nНайдено: <b>${count}</b>`;

export const ADMIN_TASK_SEARCH_NO_RESULTS = (query: string) =>
  `🔍 <b>Результаты поиска</b>\n\nПакет: <code>${query}</code>\n\n<i>Заданий с таким пакетом не найдено.</i>`;

// ── User balance ───────────────────────────────────────────────────────────

export const USER_BALANCE_HEADER = (balance: string) =>
  `💰 <b>Мой баланс</b>\n\nТекущий баланс: <b>${balance} грн</b>`;

export const USER_BALANCE_IN_QUEUE =
  `\n\n✅ <b>Вы в очереди на выплату!</b> Администратор скоро обработает платёж.`;

export const USER_BALANCE_NEED_MORE = (remaining: string, threshold: number) =>
  `\n\n⏳ Нужно ещё <b>${remaining} грн</b> для достижения порога выплаты (${threshold} грн).`;

export const USER_BALANCE_COMPLETED_SINCE_PAYOUT = '\n\n<b>Выполнено с последней выплаты:</b>\n';
export const USER_BALANCE_NO_COMPLETED = '\n\n<i>Нет выполненных заданий в текущем цикле.</i>';
export const USER_BALANCE_PAYMENT_METHOD = '\n\n<b>Способ оплаты:</b>\n';

export const USER_BALANCE_TOTAL_PAID = (total: string, count: number) => {
  const word = count === 1 ? 'выплата' : count < 5 ? 'выплаты' : 'выплат';
  return `\n\n<b>Всего выплачено:</b> ${total} грн (${count} ${word})`;
};

// ── Keyboards ─────────────────────────────────────────────────────────────

export const KB = {
  BACK: '◀ Назад',
  BACK_TASKS: '◀ К заданиям',
  BACK_MY_TASKS: '◀ Мои задания',
  BACK_REPORTS: '◀ К отчётам',
  BACK_QUEUE: '◀ К очереди',
  BACK_ADMIN: '◀ Панель администратора',
  BROWSE_TASKS: '📋 Найти задания',
  MY_TASKS: '🎯 Мои задания',
  CANCEL: '❌ Отмена',
  SKIP: 'Пропустить ▶',
  APPROVE: '✅ Одобрить',
  REJECT: '❌ Отклонить',
  YES_DELETE: '✅ Да, удалить',
  YES_REMOVE_ALL: '✅ Да, удалить все',
  YES_PAID: '✅ Да, оплачено',
  SKIP_NO_COMMENT: 'Пропустить (без комментария)',
  REVIEW: '👁 Проверить',
  VIEW_ALL_TASKS: '📋 Все задания',
  CLAIM_TASK: '🚀 Взять задание',
  SUBMIT_REPORT: '📝 Отправить отчёт',
  CREATE_TASK: '➕ Создать задание',
  MARK_PAID: (balance: string) => `✅ Отметить выплаченным (${balance} грн)`,
  SHOW_FULL_CARD: '🔓 Показать полный номер карты',
  ADD_MEDIA: '➕ Добавить материалы',
  PREVIEW: '👁 Предпросмотр',
  REMOVE_ALL: '🗑 Удалить все',
  SKIP_EXPIRY: 'Пропустить (бессрочно) ▶',
  BACK_REPORTS_ADMIN: '📊 К отчётам',
  BACK_ADMIN_MENU: '◀ Панель администратора',
  CANCEL_REJECT: '◀ Отмена',
  BACK_REX: '◀ К примерам',
  BACK_REX_DETAIL: '◀ К деталям',
  REX_CREATE: '➕ Создать пример',
  REX_COMMENT: '✏️ Изменить комментарий',
  REX_DELETE: '🗑 Удалить пример',
  REX_MEDIA: (count: number) => count > 0 ? `📎 Медиа (${count})` : '📎 Добавить медиа',
  UPLOAD_PROOFS: '➕ Загрузить скриншоты',
  CLEAR_PROOFS: '🗑 Удалить все',
  EDIT_BINANCE: '✏️ Изменить Binance ID',
  EDIT_CARD: '✏️ Изменить карту',
  SEARCH_TASKS: '🔍 Найти по пакету',
  SKIP_NO_PROOF: 'Пропустить (без скриншота) ▶',
};

// ── Main / admin menu labels ───────────────────────────────────────────────

export const MENU = {
  AVAILABLE_TASKS: '📋 Доступные задания',
  MY_TASKS: '🎯 Мои задания',
  MY_REPORTS: '📊 Мои отчёты',
  MY_BALANCE: '💰 Мой баланс',
  MAIN_PROMPT: 'Что хотите сделать?',
  ADMIN_PENDING_USERS: '👥 Ожидающие пользователи',
  ADMIN_TASKS: '📋 Задания',
  ADMIN_REPORTS: '📊 Отчёты',
  ADMIN_PAYOUTS: '💰 Выплаты',
  ADMIN_REPORT_EXAMPLES: '📝 Примеры отчётов',
  ADMIN_PROOFS: '📸 Доказательства выплат',
  MY_PROFILE: '👤 Профиль',
  PROOFS: '📸 Доказательства выплат',
  ADMIN_USER_MENU: '👤 Меню пользователя',
  ADMIN_DEACTIVATE: '🔴 Деактивировать',
  ADMIN_ACTIVATE: '🟢 Активировать',
  ADMIN_DELETE: '🗑 Удалить',
  ADMIN_HELP_MEDIA: (count: number) =>
    count > 0 ? `📎 Материалы (${count})` : '📎 Добавить материалы',
  BACK_TO_TASKS_ADMIN: '◀ К заданиям',
  REG_SKIP_BINANCE: 'Пропустить ▶',
  REG_BACK: '◀ Назад',
  REG_SKIP_CARD: 'Пропустить ▶',
};
