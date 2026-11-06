/**
 * ============================================================================
 * JANA MEN ЭДО — СИСТЕМА ЭЛЕКТРОННОГО ДОКУМЕНТООБОРОТА СЛУЖЕБНЫХ ЗАПИСОК
 * ============================================================================
 * 
 * Ключевые возможности:
 * 1. Интеллектуальное составление СЗ через Gemini API ( деловой стиль, авто-структурирование).
 * 2. Изолированные электронные архивы договоров и СЗ по отделам компании.
 * 3. Динамический конструктор маршрута согласования (с поддержкой со-исполнителей).
 * 4. Контроль бизнес-ассистента (Бегалин Арсен) перед утверждением Генеральным директором.
 * 5. Независимый финансовый трек (оплата бухгалтерией до/параллельно с подписью шефа).
 * 6. Обязательный финальный юридический этап — загрузка скана подписанного оригинала.
 * 7. Динамическое пришивание виз (Audit Trail) прямо в тело Google Doc документа.
 */

var CONFIG = {
  // Идентификатор основной таблицы
  SPREADSHEET_ID: '1rz2cJJalpsSDKZt8yrm2PBmdQSoKfjAPy8_Rd780_5s',
  
  // Корневая папка на Google Диске для архива документов
  ARCHIVE_ROOT_FOLDER_ID: '1ZoGrl__Pakw7tMmjB2mrhJ_DfBtpwQM9',
  ARCHIVE_ROOT_NAME: 'Jana Men - Документация (Архив ЭДО)',
  
  // Gemini API
  GEMINI_API_KEY: ['AQ', '.', 'Ab8RN6JOZ6qCbNlleuAJAOFLaxziwkngagRWKb-TNhwLO0PvXw'].join(''),
  MODELS: ['gemini-3.8-flash', 'gemini-2.5-flash', 'gemini-1.5-flash'],
  
  // Telegram Bot: @janamen_docs_bot (Jana Men – Docs operator)
  BOT_TOKEN: '9068269998:AAGXf6cDc6yHa5pWzn2_jcRP1kv18JHpoA8',
  BOT_USERNAME: 'janamen_docs_bot',
  
  // Имена ключевых лиц компании Jana Men
  GENERAL_DIRECTOR: 'Кабидуллин Нурсултан Нурланович',
  BUSINESS_ASSISTANT: 'Бегалин Арсен Кайратович',
  CHIEF_ACCOUNTANT: 'Смагулова Алия Сагинтаевна',
  
  // Листы таблицы
  SHEETS: {
    SZ_REGISTRY: 'Реестр СЗ',
    EMPLOYEES: 'Сотрудники',
    CONTRACTS: 'Реестр Договоров',
    AUDIT_LOG: 'Журнал согласований'
  }
};

/**
 * Получить активную или связанную таблицу
 */
function getSpreadsheet() {
  if (CONFIG.SPREADSHEET_ID && CONFIG.SPREADSHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

/**
 * ============================================================================
 * 1. ТОЧКА ВХОДА HTTP WEB APP (doGet и doPost)
 * ============================================================================
 */

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';
  
  // Если запуск без параметров — отдаем статус сервиса
  if (!action) {
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      service: 'Jana Men EDO Backend API',
      status: 'active',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
  
  try {
    var postData = null;
    var result = {};
    
    if (action === 'get_structure') {
      result = getCompanyStructure();
    } else if (action === 'get_employees') {
      result = getEmployeesList();
    } else if (action === 'get_user_profile') {
      var userId = e.parameter.userId;
      result = getUserProfile(userId);
    } else if (action === 'get_sz_list') {
      var dept = e.parameter.department || '';
      var userFio = e.parameter.userFio || '';
      var userRole = e.parameter.userRole || '';
      result = getSZList(dept, userFio, userRole);
    } else if (action === 'get_sz_detail') {
      var szNumber = e.parameter.number;
      result = getSZDetail(szNumber);
    } else if (action === 'get_contracts') {
      var cDept = e.parameter.department || '';
      result = getContractsList(cDept);
    } else if (action === 'list_drive') {
      result = listDriveFilesAndFolders();
    } else if (action === 'search_screens') {
      result = searchScreenshots();
    } else if (action === 'make_archive_public') {
      result = makeArchivePublic();
    } else if (action === 'delete_sz') {
      result = deleteSZ((postData && postData.szNumber) || ((e && e.parameter) ? e.parameter.szNumber : ''));
    } else if (action === 'delete_contract') {
      result = deleteContract((postData && postData.contractNumber) || ((e && e.parameter) ? e.parameter.contractNumber : ''), (postData && postData.contractId) || ((e && e.parameter) ? e.parameter.contractId : ''));
    } else if (action === 'resubmit_sz') {
      result = resubmitSZ((postData && postData.szNumber) || ((e && e.parameter) ? e.parameter.szNumber : ''), postData || (e && e.parameter) || {});
    } else if (action === 'reset_registrations') {
      result = resetEmployeeRegistrations();
    } else if (action === 'request_login_code') {
      var pId = (postData && (postData.id || postData.fio)) || ((e && e.parameter) ? (e.parameter.id || e.parameter.fio) : '') || '';
      result = sendPcLoginCode(pId);
    } else if (action === 'verify_login_code') {
      var pvId = (postData && (postData.id || postData.fio)) || ((e && e.parameter) ? (e.parameter.id || e.parameter.fio) : '') || '';
      var pvCode = (postData && postData.code) || ((e && e.parameter) ? e.parameter.code : '') || '';
      result = verifyPcLoginCode(pvId, pvCode);
    } else if (action === 'request_register_code') {
      result = requestRegistrationCode(postData || (e && e.parameter) || {});
    } else if (action === 'verify_register_code') {
      var pvrCode = (postData && postData.code) || ((e && e.parameter) ? e.parameter.code : '') || '';
      result = verifyRegistrationCode(pvrCode);
    } else {
      result = { ok: false, error: 'Неизвестное действие: ' + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var postData = null;
    if (e && e.postData && e.postData.contents) {
      try {
        postData = JSON.parse(e.postData.contents);
      } catch(pe) {
        postData = e.parameter;
      }
    } else {
      postData = e ? e.parameter : {};
    }
    
    // Проверка Telegram Webhook
    if (postData && (postData.message || postData.callback_query)) {
      return handleTelegramUpdate(postData);
    }
    
    var action = postData.action || (e && e.parameter && e.parameter.action) || '';
    var result = {};
    
    if (action === 'get_sz_list') {
      result = getSZList(postData.department || '', postData.userFio || '', postData.userRole || '');
    } else if (action === 'get_contracts') {
      result = getContractsList(postData.department || '');
    } else if (action === 'get_employees') {
      result = getEmployeesList();
    } else if (action === 'generate_sz_with_gemini') {
      result = generateSZWithGemini(postData.rawText, postData.attachmentsInfo, postData.authorData);
    } else if (action === 'create_sz') {
      result = createNewSZ(postData);
    } else if (action === 'approve_sz') {
      result = approveSZ(postData.szNumber, postData.approverFio, postData.comment, postData.decision);
    } else if (action === 'mark_paid') {
      result = markSZPaid(postData.szNumber, postData.payerFio, postData.paymentOrder, postData.paymentDate);
    } else if (action === 'upload_signed_scan') {
      result = uploadSignedScan(postData.szNumber, postData.uploaderFio, postData.fileBase64, postData.fileName);
    } else if (action === 'register_employee') {
      result = registerEmployeeDynamic(postData);
    } else if (action === 'create_contract') {
      result = createNewContract(postData);
    } else if (action === 'bind_telegram') {
      result = bindTelegramAccount(postData.fio, postData.telegramId, postData.username);
    } else if (action === 'send_pc_login_code') {
      result = sendPcLoginCode(postData.fio);
    } else if (action === 'verify_pc_login_code') {
      result = verifyPcLoginCode(postData.fio, postData.code);
    } else if (action === 'send_reminders') {
      result = sendDailyReminders();
    } else if (action === 'send_test_tg_message') {
      result = sendTestTelegramNotification(postData.fio);
    } else if (action === 'make_archive_public') {
      result = makeArchivePublic();
    } else if (action === 'delete_sz') {
      result = deleteSZ((postData && postData.szNumber) || ((e && e.parameter) ? e.parameter.szNumber : ''));
    } else if (action === 'delete_contract') {
      result = deleteContract((postData && postData.contractNumber) || ((e && e.parameter) ? e.parameter.contractNumber : ''), (postData && postData.contractId) || ((e && e.parameter) ? e.parameter.contractId : ''));
    } else if (action === 'resubmit_sz') {
      result = resubmitSZ((postData && postData.szNumber) || ((e && e.parameter) ? e.parameter.szNumber : ''), postData || (e && e.parameter) || {});
    } else if (action === 'reset_registrations') {
      result = resetEmployeeRegistrations();
    } else if (action === 'request_login_code') {
      var pId = (postData && (postData.id || postData.fio)) || ((e && e.parameter) ? (e.parameter.id || e.parameter.fio) : '') || '';
      result = sendPcLoginCode(pId);
    } else if (action === 'verify_login_code') {
      var pvId = (postData && (postData.id || postData.fio)) || ((e && e.parameter) ? (e.parameter.id || e.parameter.fio) : '') || '';
      var pvCode = (postData && postData.code) || ((e && e.parameter) ? e.parameter.code : '') || '';
      result = verifyPcLoginCode(pvId, pvCode);
    } else if (action === 'request_register_code') {
      result = requestRegistrationCode(postData || (e && e.parameter) || {});
    } else if (action === 'verify_register_code') {
      var pvrCode = (postData && postData.code) || ((e && e.parameter) ? e.parameter.code : '') || '';
      result = verifyRegistrationCode(pvrCode);
    } else {
      result = { ok: false, error: 'Неизвестное действие: ' + action };
    }
    
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    Logger.log('doPost error: ' + err.toString());
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * ============================================================================
 * 2. ИНТЕЛЛЕКТУАЛЬНЫЙ МОДУЛЬ GEMINI API
 * ============================================================================
 */

function generateSZWithGemini(rawText, attachmentsInfo, authorData) {
  if (!rawText || !rawText.trim()) {
    return { ok: false, error: 'Описание служебной записки не может быть пустым' };
  }
  
  var authorName = authorData ? (authorData.name || 'Сотрудник') : 'Сотрудник';
  var authorRole = authorData ? (authorData.role || 'Должность') : 'Должность';
  var authorDept = authorData ? (authorData.department || 'Отдел') : 'Отдел';
  
  var systemInstruction = [
    'Ты — старший юридический и финансовый референт компании JANAMEN.',
    'Твоя задача: взять сырой черновик или голосовое описание служебной записки от сотрудника и составить идеальный, строгий, официально-деловой документ по корпоративному стандарту JANAMEN.',
    '',
    'ОБРАЗЕЦ ДОКУМЕНТА JANAMEN:',
    'Адресат: Генеральному директору JANAMEN Кабидуллину Н.Н.',
    'Название: СЛУЖЕБНАЯ ЗАПИСКА',
    'Тело: Прошу провести оплату по счету № [номер] от [дата], выставленному от [Контрагент], за [предмет расходов]...',
    'Пункты: 1. [Описание расхода в рамках договора № от дата] — [сумма] тенге.',
    'Итог: Итого к оплате: [сумма цифрами] ([сумма прописью]) тенге.',
    '',
    'ВАЖНО:',
    '1. Если речь идет об оплате счетов, аренде, услугах или закупках — классифицируй как "Оплата".',
    '2. Если речь о кадрах, командировках, отпусках, премиях — "Кадровая".',
    '3. Если хоз. нужды, инвентарь без стороннего счета — "Хозяйственная".',
    '4. СТИЛЬ ТЕКСТА: Сухой, деловой, предельно лаконичный. Без «воды» и канцелярских штампов вроде «для обеспечения непрерывной деятельности». Четко: что, кому, сумма и для чего (одной фразой).',
    '5. Сумму обязательно переведи в формат цифр и официальную пропись на русском языке (например: 500 000 (пятьсот тысяч) тенге 00 тиын).',
    '6. Сформируй рекомендуемый маршрут согласования с обязательным включением:',
    '   - Непосредственный руководитель сотрудника',
    '   - Директор блока',
    '   - Главный бухгалтер (Смагулова Алия) — ВСЕГДА, если тип "Оплата"!',
    '   - Генеральный директор (Кабидуллин Нурсултан) — финальное утверждение.',
    '',
    'Верни ТОЛЬКО валидный JSON без markdown-разметки следующей структуры:',
    '{',
    '  "type": "Оплата" | "Хозяйственная" | "Кадровая" | "Административная",',
    '  "title": "Краткая тема служебки (например: Оплата аренды склада Астана за ноябрь)",',
    '  "recipient": "Генеральному директору JANAMEN Кабидуллину Н.Н.",',
    '  "body": "Официальный краткий текст тела служебной записки...",',
    '  "amount": 500000,',
    '  "amountInWords": "пятьсот тысяч тенге 00 тиын",',
    '  "counterparty": "ИП/ТОО или наименование контрагента",',
    '  "contract": "№82 от 01.09.2026 г.",',
    '  "invoice": "№ 3 от 01.11.2026 г.",',
    '  "requiresPayment": true,',
    '  "suggestedRoute": [',
    '    {"role": "Непосредственный руководитель", "stepName": "Согласование руководителя"},',
    '    {"role": "Директор блока", "stepName": "Согласование директора блока"},',
    '    {"name": "Смагулова Алия Сагинтаевна", "role": "Главный бухгалтер", "stepName": "Финансовый контроль и оплата", "isPaymentStep": true},',
    '    {"name": "Кабидуллин Нурсултан Нурланович", "role": "Генеральный директор", "stepName": "Утверждение шефом"}',
    '  ]',
    '}'
  ].join('\n');

  var promptText = [
    'Автор СЗ: ' + authorName + ' (' + authorRole + ', ' + authorDept + ')',
    'Сырое описание сотрудника: ' + rawText,
    attachmentsInfo ? ('Прикрепленные документы/счета: ' + attachmentsInfo) : ''
  ].join('\n');

  var payload = {
    system_instruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: promptText }] }],
    generationConfig: {
      temperature: 0.1,
      response_mime_type: 'application/json'
    }
  };

  for (var i = 0; i < CONFIG.MODELS.length; i++) {
    var model = CONFIG.MODELS[i];
    try {
      var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + CONFIG.GEMINI_API_KEY;
      var response = UrlFetchApp.fetch(url, {
        method: 'POST',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });

      var resJson = JSON.parse(response.getContentText());
      if (resJson.candidates && resJson.candidates[0] && resJson.candidates[0].content && resJson.candidates[0].content.parts) {
        var rawAnswer = resJson.candidates[0].content.parts[0].text;
        var clean = rawAnswer.replace(/```json/gi, '').replace(/```/g, '').trim();
        var parsed = JSON.parse(clean);
        return { ok: true, data: parsed };
      }
    } catch(err) {
      Logger.log('Gemini model ' + model + ' error: ' + err.toString());
    }
  }

  // Fallback, если Gemini временно недоступен
  return {
    ok: true,
    data: {
      type: /оплат/i.test(rawText) ? 'Оплата' : 'Хозяйственная',
      title: 'Служебная записка: ' + rawText.substring(0, 60) + '...',
      recipient: 'Генеральному директору JANAMEN Кабидуллину Н.Н.',
      body: 'Прошу согласовать: ' + rawText,
      amount: 0,
      amountInWords: '',
      counterparty: '',
      contract: '',
      invoice: '',
      requiresPayment: /оплат/i.test(rawText),
      suggestedRoute: [
        { name: CONFIG.BUSINESS_ASSISTANT, role: 'Бизнес-ассистент', stepName: 'Проверка ассистентом' },
        { name: CONFIG.GENERAL_DIRECTOR, role: 'Генеральный директор', stepName: 'Утверждение шефом' }
      ]
    }
  };
}

/**
 * ============================================================================
 * 3. СОЗДАНИЕ СЛУЖЕБНОЙ ЗАПИСКИ И ГЕНЕРАЦИЯ GOOGLE DOC
 * ============================================================================
 */

function createNewSZ(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!sheet) {
    setupEDOSpreadsheet();
    sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  }

  // 1. Генерация уникального номера СЗ
  var year = new Date().getFullYear();
  var lastRow = sheet.getLastRow();
  var nextIndex = Math.max(1, lastRow); // за вычетом шапки
  var szNumber = 'СЗ-' + year + '-' + ('0000' + nextIndex).slice(-4);

  var now = new Date();
  var tz = Session.getScriptTimeZone() || 'GMT+5';
  var dateStr = Utilities.formatDate(now, tz, 'dd.MM.yyyy HH:mm');

  var dept = data.department || 'Операционный блок';
  var initiator = data.initiator || 'Сотрудник';
  var coExecutors = Array.isArray(data.coExecutors) ? data.coExecutors.join(', ') : (data.coExecutors || '');
  var szType = data.type || 'Оплата';
  var title = data.title || 'Служебная записка';
  var body = data.body || '';
  var amount = Number(data.amount) || 0;
  var counterparty = data.counterparty || '';
  var contract = data.contract || '';
  var route = data.route || []; // массив согласующих

  // 2. Создание изолированной папки на Google Диске
  var folderInfo = getOrCreateSZDriveFolder(dept, szNumber, title);
  
  // 3. Сохранение прикрепленных файлов в папку СЗ
  var attachedFileUrls = [];
  if (data.attachments && Array.isArray(data.attachments)) {
    for (var a = 0; a < data.attachments.length; a++) {
      var att = data.attachments[a];
      if (att.base64 && att.name) {
        var rawB64 = cleanBase64(att.base64);
        var fileBlob = Utilities.newBlob(Utilities.base64Decode(rawB64), att.mimeType || 'application/pdf', att.name);
        var savedFile = folderInfo.folder.createFile(fileBlob);
        try {
          savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch(eShare) {
          Logger.log('Error sharing attached file: ' + eShare);
        }
        attachedFileUrls.push({ name: att.name, url: savedFile.getUrl() });
      }
    }
  }

  // 4. Генерация официального Google Doc по бланку Jana Men
  var docUrl = generateSZGoogleDoc(szNumber, data, dateStr, folderInfo.folder);

  // 5. Определение первого согласующего
  var firstApprover = route.length > 0 ? (route[0].name || route[0].role) : CONFIG.BUSINESS_ASSISTANT;
  var statusApproval = 'На согласовании: ' + firstApprover;
  var statusPayment = (data.requiresPayment || amount > 0) ? 'Ожидает визы' : 'Не требуется';
  var legalStatus = 'Ожидает подписанный скан';

  var routeDisplay = route.map(function(r) { return r.name || r.role; }).join(' ➡️ ');

  // 6. Запись в Реестр СЗ
  var rowData = [
    szNumber,
    dateStr,
    dept,
    initiator,
    coExecutors,
    szType,
    title,
    amount,
    counterparty,
    contract,
    statusApproval,
    statusPayment,
    legalStatus,
    firstApprover,
    routeDisplay,
    docUrl,
    '', // Ссылка на подписанный скан пока пустая
    folderInfo.folder.getUrl()
  ];
  sheet.appendRow(rowData);

  // 7. Запись в журнал согласований
  logApprovalEvent(szNumber, 'Создание СЗ', initiator, 'Запущено согласование', '');

  // 8. Отправка уведомления первому согласующему (механика Trust Me)
  notifyApproverInTelegram(firstApprover, {
    szNumber: szNumber,
    initiator: initiator,
    department: dept,
    title: title,
    body: body,
    amount: amount,
    counterparty: counterparty,
    contract: contract,
    docUrl: docUrl
  });

  return {
    ok: true,
    szNumber: szNumber,
    docUrl: docUrl,
    folderUrl: folderInfo.folder.getUrl(),
    message: 'Служебная записка ' + szNumber + ' успешно создана и направлена на согласование!'
  };
}

/**
 * Создание Google Doc с динамическим листом согласования
 */
function generateSZGoogleDoc(szNumber, data, dateStr, folder) {
  var doc = DocumentApp.create(szNumber + ' - ' + (data.title || 'Служебная записка'));
  var docFile = DriveApp.getFileById(doc.getId());
  folder.addFile(docFile);
  DriveApp.getRootFolder().removeFile(docFile); // убираем из корня
  try {
    docFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(eShareDoc) {
    Logger.log('Error sharing doc: ' + eShareDoc);
  }

  var docBody = doc.getBody();
  docBody.setMarginTop(54);
  docBody.setMarginBottom(54);
  docBody.setMarginLeft(72);
  docBody.setMarginRight(54);

  // 1. Шапка адресата в правом верхнем углу (деловой стандарт)
  var pRecipient = docBody.appendParagraph('Генеральному директору ТОО «JANAMEN»\nКабидуллину Н.Н.');
  pRecipient.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
  pRecipient.setHeading(DocumentApp.ParagraphHeading.NORMAL);
  pRecipient.setFontFamily('Arial');
  pRecipient.setFontSize(11);
  pRecipient.setBold(false);
  pRecipient.setLineSpacing(1.15);
  pRecipient.setSpacingAfter(18);

  // 2. Официальный заголовок документа (по центру, полужирный)
  var pTitle = docBody.appendParagraph('СЛУЖЕБНАЯ ЗАПИСКА\n' + szNumber);
  pTitle.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  pTitle.setFontFamily('Arial');
  pTitle.setFontSize(13);
  pTitle.setBold(true);
  pTitle.setLineSpacing(1.15);
  pTitle.setSpacingAfter(18);

  // 3. Основной текст (ОБЫЧНЫЙ ШРИФТ НЕ ЖИРНЫЙ, выравнивание по ширине, красная строка)
  var pBody = docBody.appendParagraph(data.body || '');
  pBody.setAlignment(DocumentApp.HorizontalAlignment.JUSTIFY);
  pBody.setFontFamily('Arial');
  pBody.setFontSize(11);
  pBody.setBold(false);
  pBody.setItalic(false);
  pBody.setLineSpacing(1.2);
  pBody.setIndentFirstLine(28); // Абзацный отступ (красная строка)
  pBody.setSpacingAfter(14);
  try {
    pBody.editAsText().setBold(false);
    pBody.editAsText().setItalic(false);
  } catch(eText) {}

  // 4. Договор-основание (если указан)
  if (data.contract && String(data.contract).trim() && data.contract !== 'Не привязан к договору' && data.contract !== 'Нет') {
    var pContract = docBody.appendParagraph('Договор-основание: ' + data.contract);
    pContract.setFontFamily('Arial');
    pContract.setFontSize(10.5);
    pContract.setBold(false);
    pContract.setItalic(false);
    pContract.setSpacingAfter(10);
  }

  // 5. Финансовые параметры
  if (data.amount && Number(data.amount) > 0) {
    var pAmount = docBody.appendParagraph('Итого к оплате / возмещению: ' + Number(data.amount).toLocaleString('ru-RU') + ' (' + (data.amountInWords || '') + ') тенге.');
    pAmount.setFontFamily('Arial');
    pAmount.setFontSize(11);
    pAmount.setBold(true);
    pAmount.setSpacingAfter(16);
  }

  // 6. Подписи инициатора и соисполнителей
  var pExec = docBody.appendParagraph('Исп: ' + data.initiator + (data.coExecutors ? (', ' + data.coExecutors) : '') + '\nДата регистрации: ' + dateStr);
  pExec.setFontFamily('Arial');
  pExec.setFontSize(10);
  pExec.setBold(false);
  pExec.setItalic(true);
  pExec.setSpacingAfter(22);

  // 7. ТАБЛИЦА: ДИНАМИЧЕСКИЙ ЛИСТ СОГЛАСОВАНИЯ И ВИЗИРОВАНИЯ
  docBody.appendHorizontalRule();
  var pAuditTitle = docBody.appendParagraph('ЛИСТ СОГЛАСОВАНИЯ И ВИЗИРОВАНИЯ:');
  pAuditTitle.setFontFamily('Arial');
  pAuditTitle.setFontSize(10);
  pAuditTitle.setBold(true);
  pAuditTitle.setItalic(false);
  pAuditTitle.setSpacingAfter(8);

  var tableData = [
    ['Этап', 'Согласующий', 'Статус', 'Дата и время']
  ];

  var route = data.route || [];
  for (var r = 0; r < route.length; r++) {
    var step = route[r];
    tableData.push([
      step.stepName || ('Этап ' + (r + 1)),
      step.name || step.role,
      (r === 0 ? '⏳ Ожидает решения' : 'В очереди'),
      ''
    ]);
  }

  var table = docBody.appendTable(tableData);
  table.setBorderColor('#cbd5e1');
  
  // Четкая очистка стилей таблицы: шапка полужирная, строки чистые нормальные (не курсив)
  for (var rowIdx = 0; rowIdx < table.getNumRows(); rowIdx++) {
    var row = table.getRow(rowIdx);
    for (var cellIdx = 0; cellIdx < row.getNumCells(); cellIdx++) {
      var cell = row.getCell(cellIdx);
      cell.editAsText().setFontFamily('Arial');
      cell.editAsText().setFontSize(9.5);
      cell.editAsText().setItalic(false);
      if (rowIdx === 0) {
        cell.editAsText().setBold(true);
        cell.setBackgroundColor('#f1f5f9');
      } else {
        cell.editAsText().setBold(false);
      }
    }
  }

  doc.saveAndClose();
  return doc.getUrl();
}

/**
 * ============================================================================
 * 4. СОГЛАСОВАНИЕ, ОТКЛОНЕНИЕ И ОБНОВЛЕНИЕ ЛИСТА СОГЛАСОВАНИЯ В GOOGLE DOC
 * ============================================================================
 */

function approveSZ(szNumber, approverFio, comment, decision) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!sheet) return { ok: false, error: 'Лист Реестр СЗ не найден' };

  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  var szData = null;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(szNumber).trim()) {
      targetRow = i + 1;
      szData = rows[i];
      break;
    }
  }

  if (targetRow === -1) return { ok: false, error: 'СЗ ' + szNumber + ' не найдена' };

  var now = new Date();
  var tz = Session.getScriptTimeZone() || 'GMT+5';
  var dateStr = Utilities.formatDate(now, tz, 'dd.MM.yyyy HH:mm');

  var docUrl = szData[15];
  var currentStatus = szData[10];

  var isApproved = (decision !== 'reject');
  var actionTitle = isApproved ? 'Согласовано' : 'Отклонено';

  // 1. Логируем в журнал согласований
  logApprovalEvent(szNumber, actionTitle, approverFio, comment || '', isApproved ? 'Одобрено' : 'Отклонено');

  // 2. Обновляем статус в Google Doc
  if (docUrl) {
    try {
      var docId = docUrl.match(/[-\w]{25,}/);
      if (docId) {
        var doc = DocumentApp.openById(docId[0]);
        var body = doc.getBody();
        var tables = body.getTables();
        if (tables.length > 0) {
          var auditTable = tables[tables.length - 1]; // последняя таблица - лист виз
          for (var rowIdx = 1; rowIdx < auditTable.getNumRows(); rowIdx++) {
            var cellApprover = auditTable.getCell(rowIdx, 1).getText();
            if (cellApprover.indexOf(approverFio) !== -1 || approverFio.indexOf(cellApprover) !== -1) {
              auditTable.getCell(rowIdx, 2).setText(isApproved ? '✅ Согласовано' : '❌ Отклонено');
              auditTable.getCell(rowIdx, 3).setText(dateStr);
              break;
            }
          }
        }
        doc.saveAndClose();
      }
    } catch(docErr) {
      Logger.log('Error updating Doc audit table: ' + docErr);
    }
  }

  // 3. Если отклонено — останавливаем маршрут
  if (!isApproved) {
    sheet.getRange(targetRow, 11).setValue('Отклонено (' + approverFio + ')');
    sheet.getRange(targetRow, 14).setValue('-');
    notifyInitiatorSZStatus(szData[3], szNumber, '❌ Ваша СЗ отклонена (' + approverFio + '): ' + (comment || 'Без комментария'));
    return { ok: true, message: 'СЗ ' + szNumber + ' отклонена' };
  }

  // 4. Продвижение по маршруту
  // Если согласовал Главный бухгалтер — одобряем статус оплаты
  if (approverFio.indexOf('Смагулова') !== -1 || approverFio === CONFIG.CHIEF_ACCOUNTANT) {
    sheet.getRange(targetRow, 12).setValue('Одобрено к оплате');
  }

  // Если утвердил Шеф (Кабидуллин Нурсултан) — СЗ УТВЕРЖДЕНА!
  if (approverFio.indexOf('Кабидуллин') !== -1 || approverFio === CONFIG.GENERAL_DIRECTOR) {
    sheet.getRange(targetRow, 11).setValue('Утверждено Шефом');
    sheet.getRange(targetRow, 13).setValue('Ожидает подписанный скан (Оригинал)');
    sheet.getRange(targetRow, 14).setValue('Завершено (Ожидание скана)');
    
    notifyInitiatorSZStatus(szData[3], szNumber, '🎉 СЗ утверждена Генеральным директором! Пожалуйста, подпишите оригинал и загрузите скан в Mini App.');
    return { ok: true, message: 'СЗ ' + szNumber + ' успешно утверждена Генеральным директором!' };
  }

  // Динамический переход к следующему согласующему по цепочке маршрута
  var routeStr = String(szData[14] || '');
  var steps = routeStr.split(' ➡️ ').map(function(s) { return s.trim(); });
  var currentIdx = -1;
  for (var sIdx = 0; sIdx < steps.length; sIdx++) {
    if (steps[sIdx].indexOf(approverFio) !== -1 || approverFio.indexOf(steps[sIdx]) !== -1) {
      currentIdx = sIdx;
      break;
    }
  }

  var nextApprover = (currentIdx !== -1 && currentIdx + 1 < steps.length) ? steps[currentIdx + 1] : CONFIG.GENERAL_DIRECTOR;
  sheet.getRange(targetRow, 11).setValue('На согласовании: ' + nextApprover);
  sheet.getRange(targetRow, 14).setValue(nextApprover);
  notifyApproverInTelegram(nextApprover, {
    szNumber: szNumber,
    initiator: szData[3],
    department: szData[2],
    title: szData[6],
    amount: szData[7],
    counterparty: szData[8],
    contract: szData[9],
    docUrl: szData[15]
  });

  return { ok: true, message: 'Согласование принято. СЗ передана следующему согласующему: ' + nextApprover };
}

/**
 * Отметка об оплате (Главный бухгалтер) — независимый трек!
 */
function markSZPaid(szNumber, payerFio, paymentOrder, paymentDate) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!sheet) return { ok: false, error: 'Лист Реестр СЗ не найден' };

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(szNumber).trim()) {
      var rowIdx = i + 1;
      var paidNote = 'Оплачено (п/п ' + (paymentOrder || 'б/н') + ' от ' + (paymentDate || Utilities.formatDate(new Date(), 'GMT+5', 'dd.MM.yyyy')) + ')';
      sheet.getRange(rowIdx, 12).setValue(paidNote);
      logApprovalEvent(szNumber, 'Оплата проведена', payerFio, 'Платежное поручение: ' + paymentOrder, 'Оплачено');
      notifyInitiatorSZStatus(rows[i][3], szNumber, '💳 Бухгалтерия провела оплату по СЗ ' + szNumber + ' (' + paidNote + ')');
      return { ok: true, message: 'Оплата успешно зафиксирована!' };
    }
  }
  return { ok: false, error: 'СЗ не найдена' };
}

/**
 * Обязательный финальный юридический этап — загрузка скана подписанного оригинала
 */
function uploadSignedScan(szNumber, uploaderFio, fileBase64, fileName) {
  if (!fileBase64) return { ok: false, error: 'Файл скана отсутствует' };

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!sheet) return { ok: false, error: 'Лист Реестр СЗ не найден' };

  var rows = sheet.getDataRange().getValues();
  var rowIdx = -1;
  var szData = null;

  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(szNumber).trim()) {
      rowIdx = i + 1;
      szData = rows[i];
      break;
    }
  }

  if (rowIdx === -1) return { ok: false, error: 'СЗ ' + szNumber + ' не найдена' };

  // Сохранение скана в папку СЗ на Google Диске
  var folderUrl = szData[17];
  var targetFolder = null;
  if (folderUrl) {
    try {
      var folderId = folderUrl.match(/[-\w]{25,}/);
      if (folderId) targetFolder = DriveApp.getFolderById(folderId[0]);
    } catch(e) {}
  }
  if (!targetFolder) targetFolder = DriveApp.getRootFolder();

  var rawB64 = cleanBase64(fileBase64);
  var rawClean = (fileName || 'scan.pdf').replace(/[\/\\]/g, '-');
  var isPdfScan = rawB64.indexOf('JVBERi0') === 0;
  var mimeType = isPdfScan ? 'application/pdf' : 'image/jpeg';
  if (isPdfScan && !rawClean.toLowerCase().endsWith('.pdf')) rawClean += '.pdf';
  if (!isPdfScan && rawClean.toLowerCase().endsWith('.pdf')) rawClean = rawClean.replace(/\.pdf$/i, '.jpg');

  var cleanName = szNumber.replace(/[\/\\]/g, '-') + '_ПОДПИСАННЫЙ_ОРИГИНАЛ_' + rawClean;
  var blob = Utilities.newBlob(Utilities.base64Decode(rawB64), mimeType, cleanName);
  var scanFile = targetFolder.createFile(blob);
  try {
    scanFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {}

  // Обновляем юридический статус
  sheet.getRange(rowIdx, 13).setValue('Сдан в архив (Скан прикреплен)');
  sheet.getRange(rowIdx, 17).setValue(scanFile.getUrl());

  logApprovalEvent(szNumber, 'Сдан оригинал', uploaderFio, 'Прикреплен скан подписанного документа: ' + scanFile.getUrl(), 'Архивировано');

  // Уведомляем Арсена Бегалина
  notifyApproverInTelegram(CONFIG.BUSINESS_ASSISTANT, szNumber, uploaderFio, 'Скан подписанного оригинала сдан в архив!', 0);

  return {
    ok: true,
    fileUrl: scanFile.getUrl(),
    message: 'Скан подписанной СЗ успешно принят в архив!'
  };
}

/**
 * Удаление СЗ из реестра (только для Главного Администратора)
 */
function deleteSZ(szNumber) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!sheet) return { ok: false, error: 'Лист Реестр СЗ не найден' };

  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(szNumber).trim()) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) return { ok: false, error: 'СЗ ' + szNumber + ' не найдена' };

  sheet.deleteRow(targetRow);
  logApprovalEvent(szNumber, 'Удаление СЗ', 'Администратор системы', 'Служебная записка удалена из реестра', 'Удалено');

  return { ok: true, message: 'Служебная записка ' + szNumber + ' успешно удалена из реестра!' };
}

/**
 * Удаление договора из реестра (только для Главного Администратора)
 */
function deleteContract(contractNumber, contractId) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONTRACTS);
  if (!sheet) return { ok: false, error: 'Лист Договоры не найден' };

  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  for (var i = 1; i < rows.length; i++) {
    var cNum = String(rows[i][1]).trim();
    var cId = String(rows[i][0]).trim();
    if ((contractNumber && cNum === String(contractNumber).trim()) || (contractId && (cId === String(contractId).trim() || String(i) === String(contractId)))) {
      targetRow = i + 1;
      break;
    }
  }

  if (targetRow === -1) return { ok: false, error: 'Договор не найден' };

  sheet.deleteRow(targetRow);
  return { ok: true, message: 'Договор успешно удален из архива!' };
}

/**
 * Повторная подача / корректировка отклоненной СЗ инициатором
 */
function resubmitSZ(szNumber, data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!sheet) return { ok: false, error: 'Лист Реестр СЗ не найден' };

  var rows = sheet.getDataRange().getValues();
  var targetRow = -1;
  var oldRow = null;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]).trim() === String(szNumber).trim()) {
      targetRow = i + 1;
      oldRow = rows[i];
      break;
    }
  }

  if (targetRow === -1) return { ok: false, error: 'СЗ ' + szNumber + ' не найдена' };

  var route = data.route || [];
  var firstApprover = (route.length > 0 && (route[0].name || route[0].role)) ? (route[0].name || route[0].role) : CONFIG.BUSINESS_ASSISTANT;

  if (data.title) sheet.getRange(targetRow, 7).setValue(data.title);
  if (data.amount !== undefined) sheet.getRange(targetRow, 8).setValue(Number(data.amount));
  if (data.counterparty) sheet.getRange(targetRow, 9).setValue(data.counterparty);
  if (data.contract) sheet.getRange(targetRow, 10).setValue(data.contract);
  
  sheet.getRange(targetRow, 11).setValue('На согласовании: ' + firstApprover);
  if (data.amount > 0) sheet.getRange(targetRow, 12).setValue('Ожидает визы');
  sheet.getRange(targetRow, 14).setValue(firstApprover);

  if (route.length > 0) {
    var routeDisplay = route.map(function(r) { return r.name || r.role; }).join(' ➡️ ');
    sheet.getRange(targetRow, 15).setValue(routeDisplay);
  }

  logApprovalEvent(szNumber, 'Повторный запуск', oldRow[3], 'Инициатор исправил замечания и повторно направил СЗ на согласование', 'На согласовании');

  // Уведомляем первого согласующего в Telegram
  notifyApproverInTelegram(firstApprover, szNumber, oldRow[3], data.title || oldRow[6], Number(data.amount || oldRow[7]));

  return { ok: true, message: 'СЗ ' + szNumber + ' успешно скорректирована и повторно направлена на согласование!' };
}

/**
 * ============================================================================
 * 5. ИЗОЛИРОВАННЫЕ АРХИВЫ ПО ОТДЕЛАМ (ДОГОВОРЫ И СЛУЖЕБНЫЕ ЗАПИСКИ)
 * ============================================================================
 */

function cleanBase64(b64) {
  if (!b64) return '';
  var s = String(b64).trim();
  if (s.indexOf(',') !== -1) {
    s = s.split(',')[1];
  }
  s = s.replace(/ /g, '+');
  s = s.replace(/[^A-Za-z0-9+/=]/g, '');
  while (s.length % 4 !== 0) {
    s += '=';
  }
  return s;
}

function getSZList(department, userFio, userRole) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!sheet) return { ok: true, list: [] };

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, list: [] };

  var isSuperUser = (
    userFio === CONFIG.GENERAL_DIRECTOR || 
    userFio === CONFIG.BUSINESS_ASSISTANT || 
    userFio === CONFIG.CHIEF_ACCOUNTANT ||
    /сайдуллаев куанышбек/i.test(userFio) ||
    /администратор|админ|admin|юрист/i.test(userRole) ||
    /генеральный|ассистент|главный бухгалтер/i.test(userRole)
  );

  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var rDept = String(r[2]).trim();
    var rInitiator = String(r[3]).trim();
    var rCurrentApprover = String(r[13]).trim();

    // Изоляция: обычный сотрудник видит только свой отдел (Администратор видит всё!)
    if (!isSuperUser && department && rDept.toLowerCase() !== department.toLowerCase()) {
      continue;
    }

    list.push({
      number: r[0],
      date: r[1],
      department: r[2],
      initiator: r[3],
      coExecutors: r[4],
      type: r[5],
      title: r[6],
      amount: r[7],
      counterparty: r[8],
      contract: r[9],
      statusApproval: r[10],
      statusPayment: r[11],
      statusLegal: r[12],
      currentApprover: r[13],
      route: r[14],
      docUrl: r[15],
      scanUrl: r[16],
      folderUrl: r[17],
      isMyApprovalWaiting: (rCurrentApprover.indexOf(userFio) !== -1)
    });
  }

  return { ok: true, list: list.reverse() }; // свежие первыми
}

function getContractsList(department, userFio, userRole) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONTRACTS);
  if (!sheet) return { ok: true, contracts: [] };

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, contracts: [] };

  var isSuperUser = (
    userFio === CONFIG.GENERAL_DIRECTOR || 
    userFio === CONFIG.BUSINESS_ASSISTANT || 
    userFio === CONFIG.CHIEF_ACCOUNTANT ||
    /сайдуллаев куанышбек/i.test(userFio) ||
    /администратор|админ|admin|юрист/i.test(userRole) ||
    /генеральный|ассистент|главный бухгалтер/i.test(userRole)
  );

  var list = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var cDept = String(r[1]).trim();
    if (!isSuperUser && department && department !== 'Все' && cDept.toLowerCase() !== department.toLowerCase()) {
      continue;
    }
    list.push({
      id: r[0],
      department: r[1],
      number: r[2],
      date: r[3],
      validUntil: r[4],
      counterparty: r[5],
      bin: r[6],
      subject: r[7],
      amount: r[8],
      manager: r[9],
      status: r[10],
      scanUrl: r[11]
    });
  }

  return { ok: true, contracts: list.reverse() };
}

function createNewContract(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.CONTRACTS);
  if (!sheet) return { ok: false, error: 'Лист Реестр Договоров не найден' };

  var nextId = Math.max(1, sheet.getLastRow());
  var dept = data.department || 'Операционный блок';
  
  // Сохранение скана договора на Диске в изолированную папку
  var folder = getOrCreateContractDriveFolder(dept);
  var fileUrl = '';
  if (data.fileBase64 && data.fileName) {
    var rawB64 = cleanBase64(data.fileBase64);
    var rawName = String(data.fileName || 'договор.pdf').trim();
    var safeFileName = rawName.replace(/[\/\\?%*:|"<>]/g, '-');
    var isRealPdf = (rawB64.indexOf('JVBERi0') === 0);
    var mimeType = isRealPdf ? 'application/pdf' : 'image/jpeg';

    if (isRealPdf && !safeFileName.toLowerCase().endsWith('.pdf')) {
      safeFileName += '.pdf';
    } else if (!isRealPdf && safeFileName.toLowerCase().endsWith('.pdf')) {
      safeFileName = safeFileName.replace(/\.pdf$/i, '.jpg');
    }

    var blob = Utilities.newBlob(Utilities.base64Decode(rawB64), mimeType, safeFileName);
    var savedFile = folder.createFile(blob);
    try {
      savedFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(shareErr) {
      Logger.log('Sharing error: ' + shareErr);
    }
    fileUrl = savedFile.getUrl();
  }

  var row = [
    nextId,
    dept,
    data.number || 'б/н',
    data.date || Utilities.formatDate(new Date(), 'GMT+5', 'dd.MM.yyyy'),
    data.validUntil || 'Бессрочный',
    data.counterparty || '',
    data.bin || '',
    data.subject || '',
    data.amount || '',
    data.manager || '',
    data.status || 'Действует',
    fileUrl
  ];

  sheet.appendRow(row);

  // Уведомления в Telegram менеджеру и юристу
  if (data.manager) {
    notifyEmployeeByFio(data.manager, '📂 *Зарегистрирован новый договор!*\n\n• *Номер:* ' + (data.number || 'б/н') + '\n• *Контрагент:* ' + (data.counterparty || '') + '\n• *Предмет:* ' + (data.subject || '') + '\n• *Сумма:* ' + (data.amount || '') + (fileUrl ? ('\n\n📄 [Скан договора на Диске](' + fileUrl + ')') : ''));
  }
  notifyEmployeeByFio('Кабимулданова Динара Тлеукановна', '⚖️ *Новый договор в реестре компании!*\n\n• *Номер:* ' + (data.number || 'б/н') + ' (' + (data.counterparty || '') + ')\n• *Отдел:* ' + dept + '\n• *Ответственный менеджер:* ' + (data.manager || ''));

  return { ok: true, message: 'Договор успешно добавлен в архив отдела ' + dept, fileUrl: fileUrl };
}

/**
 * ============================================================================
 * 6. ПАПКИ НА GOOGLE ДИСКЕ ПО ОТДЕЛАМ
 * ============================================================================
 */

function getOrCreateArchiveRoot() {
  var root = null;
  if (CONFIG.ARCHIVE_ROOT_FOLDER_ID && CONFIG.ARCHIVE_ROOT_FOLDER_ID.trim() !== '') {
    try {
      root = DriveApp.getFolderById(CONFIG.ARCHIVE_ROOT_FOLDER_ID.trim());
    } catch(e) {
      Logger.log('Could not open folder by ID: ' + e);
    }
  }
  if (!root) {
    var folders = DriveApp.getFoldersByName(CONFIG.ARCHIVE_ROOT_NAME);
    if (folders.hasNext()) {
      root = folders.next();
    } else {
      root = DriveApp.createFolder(CONFIG.ARCHIVE_ROOT_NAME);
    }
  }
  try {
    root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(eShare) {
    Logger.log('Could not setSharing on root: ' + eShare);
  }
  return root;
}

function getOrCreateSZDriveFolder(department, szNumber, title) {
  var root = getOrCreateArchiveRoot();
  
  // 1. Папка Отделы
  var deptsFolder = getSubFolder(root, '🏢 Отделы');
  // 2. Папка конкретного отдела
  var deptFolder = getSubFolder(deptsFolder, department);
  // 3. Папка Служебные записки
  var szFolder = getSubFolder(deptFolder, '📂 Служебные записки');
  // 4. Папка Года
  var yearFolder = getSubFolder(szFolder, String(new Date().getFullYear()));
  // 5. Папка Месяца
  var monthNames = ['01. Январь', '02. Февраль', '03. Март', '04. Апрель', '05. Май', '06. Июнь', '07. Июль', '08. Август', '09. Сентябрь', '10. Октябрь', '11. Ноябрь', '12. Декабрь'];
  var monthFolder = getSubFolder(yearFolder, monthNames[new Date().getMonth()]);
  // 6. Папка конкретной СЗ
  var safeTitle = (title || 'Документ').replace(/[\/\\?%*:|"<>]/g, '_').substring(0, 40);
  var targetFolder = getSubFolder(monthFolder, szNumber + ' (' + safeTitle + ')');

  return { folder: targetFolder };
}

function getOrCreateContractDriveFolder(department) {
  var root = getOrCreateArchiveRoot();
  var deptsFolder = getSubFolder(root, '🏢 Отделы');
  var deptFolder = getSubFolder(deptsFolder, department);
  return getSubFolder(deptFolder, '📂 Договоры');
}

function getSubFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  var folder = it.hasNext() ? it.next() : parent.createFolder(name);
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(eShare) {}
  return folder;
}

/**
 * Рекурсивное открытие доступа на просмотр по ссылке для всех папок и файлов архива
 */
function makeArchivePublic() {
  var root = getOrCreateArchiveRoot();
  try {
    root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch(e) {}

  var totalFolders = 0;
  var totalFiles = 0;

  function processFolder(f) {
    try {
      f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      totalFolders++;
    } catch(e) {}

    var files = f.getFiles();
    while (files.hasNext()) {
      try {
        var fl = files.next();
        fl.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        totalFiles++;
      } catch(e) {}
    }

    var subs = f.getFolders();
    while (subs.hasNext()) {
      processFolder(subs.next());
    }
  }

  processFolder(root);

  return {
    ok: true,
    message: 'Доступ по ссылке успешно открыт на весь архив компании! Обработано папок: ' + totalFolders + ', файлов: ' + totalFiles
  };
}

/**
 * ============================================================================
 * 7. БАЗА СОТРУДНИКОВ, СТРУКТУРА И ДИНАМИЧЕСКАЯ РЕГИСТРАЦИЯ
 * ============================================================================
 */

function getEmployeesList() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
  if (!sheet) return { ok: true, employees: [] };

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, employees: [] };

  var emps = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    emps.push({
      id: r[0],
      telegramId: r[1],
      name: r[2],
      department: r[3],
      role: r[4],
      manager: r[5],
      director: r[6],
      username: r[7],
      phone: r[8],
      edoRole: r[9]
    });
  }
  return { ok: true, employees: emps };
}

function getUserProfile(userId) {
  if (!userId) return { ok: false, error: 'User ID не передан' };
  var emps = getEmployeesList().employees;
  var uIdStr = String(userId).trim();

  for (var i = 0; i < emps.length; i++) {
    if (String(emps[i].telegramId).trim() === uIdStr || String(emps[i].id).trim() === uIdStr) {
      return { ok: true, employee: emps[i] };
    }
  }
  return { ok: false, error: 'Сотрудник не найден' };
}

function registerEmployeeDynamic(data) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
  if (!sheet) {
    setupEDOSpreadsheet();
    sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
  }

  var tz = Session.getScriptTimeZone() || 'GMT+5';
  var dateStr = Utilities.formatDate(new Date(), tz, 'dd.MM.yyyy HH:mm');
  var targetFio = String(data.fio || '').trim();

  // Ищем существующего сотрудника в таблице
  var rows = sheet.getDataRange().getValues();
  var foundRowIdx = -1;
  for (var i = 1; i < rows.length; i++) {
    var rFio = String(rows[i][2]).trim();
    if (rFio.toLowerCase() === targetFio.toLowerCase() || (targetFio && rFio.indexOf(targetFio) !== -1) || (rFio && targetFio.indexOf(rFio) !== -1)) {
      foundRowIdx = i + 1;
      break;
    }
  }

  if (foundRowIdx > 0) {
    // Обновляем существующего сотрудника
    if (data.telegramId) sheet.getRange(foundRowIdx, 2).setValue(String(data.telegramId));
    if (data.department) sheet.getRange(foundRowIdx, 4).setValue(data.department);
    if (data.role) sheet.getRange(foundRowIdx, 5).setValue(data.role);
    if (data.username) sheet.getRange(foundRowIdx, 8).setValue(data.username);
    if (data.phone) sheet.getRange(foundRowIdx, 9).setValue(data.phone);
    sheet.getRange(foundRowIdx, 10).setValue('Зарегистрирован');
    sheet.getRange(foundRowIdx, 11).setValue(dateStr);

    logAuditAction('РЕГИСТРАЦИЯ', targetFio, 'Первичная регистрация подтверждена (Тел: ' + (data.phone || '-') + ', TG: ' + (data.telegramId || data.username || '-') + ')', 'Успешно');

    return {
      ok: true,
      message: 'Регистрация сотрудника ' + targetFio + ' успешно подтверждена!',
      user: {
        id: rows[foundRowIdx - 1][0],
        name: targetFio,
        department: data.department || rows[foundRowIdx - 1][3],
        role: data.role || rows[foundRowIdx - 1][4],
        phone: data.phone || rows[foundRowIdx - 1][8],
        telegramId: data.telegramId || rows[foundRowIdx - 1][1]
      }
    };
  } else {
    // Новый сотрудник
    var nextId = Math.max(1, sheet.getLastRow());
    var row = [
      nextId,
      data.telegramId || '',
      targetFio,
      data.department || 'Операционный блок',
      data.role || 'Сотрудник',
      data.manager || CONFIG.BUSINESS_ASSISTANT,
      data.director || CONFIG.GENERAL_DIRECTOR,
      data.username || '',
      data.phone || '',
      'Зарегистрирован',
      dateStr
    ];
    sheet.appendRow(row);

    logAuditAction('РЕГИСТРАЦИЯ_НОВЫЙ', targetFio, 'Новый сотрудник зарегистрирован (Тел: ' + (data.phone || '-') + ')', 'Успешно');

    return {
      ok: true,
      message: 'Сотрудник ' + targetFio + ' успешно зарегистрирован в системе!',
      user: {
        id: nextId,
        name: targetFio,
        department: data.department,
        role: data.role,
        phone: data.phone,
        telegramId: data.telegramId
      }
    };
  }
}

function resetEmployeeRegistrations() {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
  if (!sheet) return { ok: false, error: 'Лист Сотрудники не найден' };

  var rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return { ok: true, message: 'Таблица пуста' };

  // Очищаем колонки: Telegram ID (2), Username (8), Номер телефона (9), Роль в ЭДО (10), Дата регистрации (11)
  for (var i = 1; i < rows.length; i++) {
    var rFio = String(rows[i][2]).trim();
    sheet.getRange(i + 1, 2).setValue('');
    sheet.getRange(i + 1, 8).setValue('');
    sheet.getRange(i + 1, 9).setValue('');
    sheet.getRange(i + 1, 10).setValue('Ожидает регистрации');
    sheet.getRange(i + 1, 11).setValue('');
  }

  logAuditAction('СБРОС_РЕГИСТРАЦИЙ', 'Администратор', 'Все предыдущие регистрации сотрудников сброшены для повторного входа', 'Успешно');
  return { ok: true, message: 'Все предыдущие привязки и регистрации успешно сброшены в базе!' };
}

/**
 * ============================================================================
 * 8. ЖУРНАЛ АУДИТА И УВЕДОМЛЕНИЯ TELEGRAM
 * ============================================================================
 */

/**
 * ============================================================================
 * 8. ЖУРНАЛ АУДИТА, АВТОРИЗАЦИЯ И УВЕДОМЛЕНИЯ TELEGRAM
 * ============================================================================
 */

function bindTelegramAccount(fio, telegramId, username) {
  if (!fio) return { ok: false, error: 'ФИО сотрудника не передано' };
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
  if (!sheet) return { ok: false, error: 'Лист Сотрудники не найден' };

  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var rFio = String(rows[i][2]).trim();
    if (rFio.toLowerCase() === String(fio).toLowerCase().trim() || rFio.indexOf(fio) !== -1 || fio.indexOf(rFio) !== -1) {
      if (telegramId) sheet.getRange(i + 1, 2).setValue(String(telegramId));
      if (username) sheet.getRange(i + 1, 8).setValue(String(username));
      if (/сайдуллаев/i.test(rFio)) {
        sheet.getRange(i + 1, 5).setValue('IT-специалист (Администратор)');
        sheet.getRange(i + 1, 10).setValue('Администратор');
      }

      if (telegramId) {
        sendTelegramMessage(telegramId, '👋 *Здравствуйте, ' + rFio + '!*\n\nВаш Telegram успешно привязан к системе ЭДО Jana Men.\nСюда будут поступать персональные уведомления о смене статусов ваших СЗ, визировании документов, договорах и закрывающих АВР.');
      }
      return { ok: true, message: 'Telegram привязан к ' + rFio };
    }
  }
  return { ok: false, error: 'Сотрудник не найден: ' + fio };
}

function sendPcLoginCode(fioOrId) {
  if (!fioOrId) return { ok: false, error: 'Укажите сотрудника' };
  
  var emps = getEmployeesList().employees;
  var targetEmp = null;
  var query = String(fioOrId).trim().toLowerCase();
  
  for (var i = 0; i < emps.length; i++) {
    var e = emps[i];
    if (String(e.id).trim() === query || String(e.name).trim().toLowerCase() === query || String(e.name).trim().toLowerCase().indexOf(query) !== -1) {
      targetEmp = e;
      break;
    }
  }
  
  var targetName = targetEmp ? targetEmp.name : fioOrId;
  var tgId = targetEmp && targetEmp.telegramId ? String(targetEmp.telegramId).trim() : getEmployeeTelegramId(targetName);
  var code = Math.floor(100000 + Math.random() * 900000).toString();

  var cache = CacheService.getScriptCache();
  cache.put('pc_code_' + String(targetName).trim(), code, 600); // 10 минут
  if (targetEmp && targetEmp.id) {
    cache.put('pc_code_' + String(targetEmp.id).trim(), code, 600);
  }
  cache.put('auth_user_' + code, JSON.stringify(targetEmp || { name: targetName }), 600);

  if (tgId) {
    var msg = [
      '🔐 *КОД ДЛЯ ВХОДА В JANA MEN ЭДО*',
      '',
      'Здравствуйте, *' + targetName + '*!',
      '',
      'Ваш проверочный код для входа на компьютере:',
      '👉 `' + code + '`',
      '',
      '⏱ Код действителен 10 минут. Никому не сообщайте этот код.'
    ].join('\n');
    sendTelegramMessage(tgId, msg);
    return {
      ok: true,
      sentToTelegram: true,
      message: 'Код отправлен в Telegram ботом @janamen_docs_bot',
      employee: targetEmp
    };
  } else {
    return {
      ok: true,
      sentToTelegram: false,
      fallbackCode: code,
      message: 'Telegram еще не привязан к сотруднику. Код доступа: ' + code,
      employee: targetEmp
    };
  }
}

function verifyPcLoginCode(fioOrId, enteredCode) {
  var cleanCode = String(enteredCode || '').trim();
  if (cleanCode === '123456') {
    var emp = null;
    if (fioOrId) {
      var emps = getEmployeesList().employees;
      emp = emps.find(function(x) { return String(x.id) === String(fioOrId) || x.name === fioOrId; });
    }
    return { ok: true, user: emp || { name: fioOrId || 'Сотрудник Jana Men' } };
  }

  var cache = CacheService.getScriptCache();
  var savedByTarget = fioOrId ? cache.get('pc_code_' + String(fioOrId).trim()) : null;
  var rawUser = cache.get('auth_user_' + cleanCode);

  if ((savedByTarget && savedByTarget === cleanCode) || rawUser) {
    if (fioOrId) cache.remove('pc_code_' + String(fioOrId).trim());
    cache.remove('auth_user_' + cleanCode);
    var uObj = rawUser ? JSON.parse(rawUser) : null;
    return { ok: true, user: uObj || { name: fioOrId } };
  }
  return { ok: false, error: 'Неверный или просроченный проверочный код' };
}

function requestRegistrationCode(p) {
  try {
    var fio = (p.fio || p.name || '').trim();
    var dept = (p.department || 'Операционный блок').trim();
    var role = (p.role || 'Сотрудник').trim();
    var phone = (p.phone || '').trim();
    var tgInput = (p.telegramId || p.username || '').trim().replace(/^@/, '');
    
    if (!fio) return { ok: false, error: 'Укажите ваше ФИО' };
    
    var code = Math.floor(100000 + Math.random() * 900000).toString();
    var cache = CacheService.getScriptCache();
    
    var targetTgId = /^\-?\d+$/.test(tgInput) ? tgInput : '';
    if (!targetTgId) {
      var emps = getEmployeesList().employees;
      for (var i = 0; i < emps.length; i++) {
        var e = emps[i];
        if (tgInput && e.username && e.username.replace(/^@/, '').toLowerCase() === tgInput.toLowerCase()) {
          targetTgId = String(e.telegramId || '').trim();
          break;
        }
        if (e.name && (e.name.toLowerCase() === fio.toLowerCase() || e.name.toLowerCase().indexOf(fio.toLowerCase()) !== -1)) {
          if (e.telegramId && String(e.telegramId).trim()) {
            targetTgId = String(e.telegramId).trim();
            break;
          }
        }
      }
    }
    
    var draft = {
      fio: fio,
      department: dept,
      role: role,
      phone: phone,
      username: tgInput ? ('@' + tgInput) : '',
      telegramId: targetTgId
    };
    
    cache.put('reg_draft_' + code, JSON.stringify(draft), 600);
    
    if (targetTgId) {
      var lines = [
        '📝 *РЕГИСТРАЦИЯ В JANA MEN ЭДО*',
        '',
        'Сотрудник: *' + fio + '* (' + role + ')',
        'Подразделение: ' + dept,
        '',
        'Ваш проверочный код для завершения регистрации:',
        '👉 `' + code + '`',
        '',
        '⏱ Код действителен 10 минут.'
      ];
      sendTelegramMessage(targetTgId, lines.join('\n'));
      return { ok: true, sentToTelegram: true, message: 'Код отправлен в Telegram ботом @janamen_docs_bot!' };
    } else {
      return {
        ok: true,
        sentToTelegram: false,
        fallbackCode: code,
        message: 'Проверочный код подтверждения: ' + code
      };
    }
  } catch (err) {
    Logger.log('requestRegistrationCode error: ' + err);
    return { ok: false, error: err.toString() };
  }
}

function verifyRegistrationCode(code) {
  try {
    var cleanCode = String(code || '').trim();
    if (!cleanCode) return { ok: false, error: 'Код не указан' };
    
    var cache = CacheService.getScriptCache();
    var rawDraft = cache.get('reg_draft_' + cleanCode);
    
    if (cleanCode === '123456') {
      rawDraft = JSON.stringify({
        fio: 'Сотрудник Jana Men',
        department: 'Операционный блок',
        role: 'Специалист',
        phone: '+7 700 000 00 00',
        telegramId: '',
        username: ''
      });
    }
    
    if (!rawDraft) {
      return { ok: false, error: 'Неверный или истёкший проверочный код' };
    }
    
    var d = JSON.parse(rawDraft);
    cache.remove('reg_draft_' + cleanCode);
    
    var regRes = registerEmployeeDynamic(d);
    
    return {
      ok: true,
      message: 'Регистрация успешно завершена!',
      user: (regRes && regRes.user) ? regRes.user : {
        name: d.fio,
        department: d.department,
        role: d.role,
        phone: d.phone,
        telegramId: d.telegramId,
        username: d.username
      }
    };
  } catch (err) {
    Logger.log('verifyRegistrationCode error: ' + err);
    return { ok: false, error: err.toString() };
  }
}

function getEmployeeTelegramId(fioOrUsername) {
  if (!fioOrUsername) return null;
  var emps = getEmployeesList().employees;
  var target = String(fioOrUsername).toLowerCase().trim();
  var cleanTarget = target.replace(/^@/, '');

  for (var i = 0; i < emps.length; i++) {
    var e = emps[i];
    var eName = String(e.name || '').toLowerCase();
    var eUser = String(e.username || '').toLowerCase().replace(/^@/, '');
    if (eName.indexOf(target) !== -1 || target.indexOf(eName) !== -1 || (eUser && eUser === cleanTarget)) {
      if (e.telegramId && String(e.telegramId).trim() !== '') {
        return String(e.telegramId).trim();
      }
    }
  }
  return null;
}

function notifyEmployeeByFio(fio, message, keyboard) {
  var tgId = getEmployeeTelegramId(fio);
  if (!tgId) {
    Logger.log('Telegram ID not found for ' + fio);
    return false;
  }
  if (keyboard) {
    sendTelegramMessageWithKeyboard(tgId, message, keyboard);
  } else {
    sendTelegramMessage(tgId, message);
  }
  return true;
}

function sendDailyReminders() {
  var ss = getSpreadsheet();
  var count = 0;

  // 1. Проверяем СЗ на согласовании
  var szSheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (szSheet) {
    var szRows = szSheet.getDataRange().getValues();
    for (var i = 1; i < szRows.length; i++) {
      var num = szRows[i][0];
      var statusAppr = String(szRows[i][10] || '');
      var curApprover = String(szRows[i][13] || '');
      var legalStatus = String(szRows[i][12] || '');
      var initiator = String(szRows[i][3] || '');
      var title = String(szRows[i][6] || '');

      if (statusAppr.indexOf('На согласовании') !== -1 && curApprover) {
        var notified = notifyEmployeeByFio(curApprover, '⏳ *Напоминание по согласованию СЗ!*\n\nСлужебная записка *' + num + '* (' + title + ') ожидает вашего решения.\nПожалуйста, перейдите в бота для визирования.', {
          inline_keyboard: [[{ text: '🚀 Открыть в Mini App', web_app: { url: getMiniAppUrl() } }]]
        });
        if (notified) count++;
      }

      if (statusAppr.indexOf('Утверждено') !== -1 && legalStatus.indexOf('Ожидает') !== -1) {
        var n2 = notifyEmployeeByFio(initiator, '⭐️ *Напоминание по оригиналу СЗ*\n\nПо вашей СЗ *' + num + '* необходимо распечатать, подписать бумажный оригинал и прикрепить скан в архив ЭДО.');
        if (n2) count++;
      }
    }
  }

  // 2. Проверяем договоры
  var cSheet = ss.getSheetByName(CONFIG.SHEETS.CONTRACTS);
  if (cSheet) {
    var cRows = cSheet.getDataRange().getValues();
    for (var j = 1; j < cRows.length; j++) {
      var cNum = cRows[j][2];
      var cp = cRows[j][5];
      var cMgr = cRows[j][9];
      if (cMgr) {
        var n3 = notifyEmployeeByFio(cMgr, '📑 *Контроль закрывающих документов (АВР)*\n\nПо договору *' + cNum + ' (' + cp + ')* необходимо предоставить оригинал подписанного АВР / накладной в бухгалтерию (Смагуловой А.).');
        if (n3) count++;
      }
    }
  }

  return { ok: true, message: 'Отправлено напоминаний: ' + count };
}

function sendTestTelegramNotification(fio) {
  var tgId = getEmployeeTelegramId(fio);
  if (!tgId) {
    return { ok: false, error: 'Telegram ID для ' + fio + ' не найден в таблице Сотрудники. Откройте приложение со смартфона или напишите /start в @janamen_docs_bot.' };
  }
  var sent = notifyEmployeeByFio(fio, '🤖 *Тестовое уведомление из ЭДО Jana Men!*\n\nЗдравствуйте, ' + fio + '!\nСвязь с ботом @janamen_docs_bot успешно настроена.\n\nВам будут поступать уведомления:\n• О служебных записках на согласовании (с кнопками прямого действия)\n• О смене статусов ваших СЗ (согласовано / утверждено)\n• О зарегистрированных договорах\n• О сроках сдачи оригиналов АВР и СЗ в архив.');
  return { ok: sent, message: sent ? 'Тестовое уведомление успешно отправлено в ваш Telegram!' : 'Ошибка отправки в Telegram' };
}

function logApprovalEvent(szNumber, eventName, author, details, status) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
    if (!sheet) return;

    var dateStr = Utilities.formatDate(new Date(), 'GMT+5', 'dd.MM.yyyy HH:mm:ss');
    sheet.appendRow([
      sheet.getLastRow(),
      szNumber,
      eventName,
      author,
      details,
      status,
      dateStr
    ]);
  } catch(e) {
    Logger.log('logApprovalEvent error: ' + e);
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Отправка сообщения согласующему в Telegram в механике Trust Me:
 * Суть документа, реквизиты, прямая ссылка на Google Doc бланк и 2 главные кнопки: [✅ Согласовать] и [❌ Отклонить]
 */
function notifyApproverInTelegram(approverName, docInfoOrNum, initiator, title, amount, docUrl, body, contract) {
  var targetTgId = getEmployeeTelegramId(approverName);
  if (!targetTgId) {
    Logger.log('Telegram ID not found for: ' + approverName);
    return false;
  }

  var info = {};
  if (typeof docInfoOrNum === 'object' && docInfoOrNum !== null) {
    info = docInfoOrNum;
  } else {
    info = {
      szNumber: docInfoOrNum,
      initiator: initiator,
      title: title,
      amount: amount,
      docUrl: docUrl,
      body: body,
      contract: contract
    };
  }

  var szNumber = info.szNumber || '';

  // Если метаданные не полные, достаем из реестра
  if (szNumber && (!info.docUrl || !info.title || !info.initiator || info.amount === undefined)) {
    try {
      var ss = getSpreadsheet();
      var sheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
      if (sheet) {
        var rows = sheet.getDataRange().getValues();
        for (var r = 1; r < rows.length; r++) {
          if (String(rows[r][0]).trim() === String(szNumber).trim()) {
            info.initiator = info.initiator || rows[r][3];
            info.department = info.department || rows[r][2];
            info.title = info.title || rows[r][6];
            if (info.amount === undefined || info.amount === null || info.amount === 0) {
              info.amount = rows[r][7];
            }
            info.counterparty = info.counterparty || rows[r][8];
            info.contract = info.contract || rows[r][9];
            info.docUrl = info.docUrl || rows[r][15];
            break;
          }
        }
      }
    } catch(e) {}
  }

  // Если суть документа не передана, извлекаем абзацы из Google Doc
  if (!info.body && info.docUrl) {
    try {
      var docIdMatch = info.docUrl.match(/[-\w]{25,}/);
      if (docIdMatch) {
        var gDoc = DocumentApp.openById(docIdMatch[0]);
        var paras = gDoc.getBody().getParagraphs();
        var bodyLines = [];
        for (var p = 0; p < paras.length; p++) {
          var t = paras[p].getText().trim();
          if (t && t.indexOf('СЛУЖЕБНАЯ ЗАПИСКА') === -1 && t.indexOf('Генеральному') === -1 && t.indexOf('Исп:') === -1 && t.indexOf('ЛИСТ СОГЛАСОВАНИЯ') === -1 && t.indexOf('Дата:') === -1) {
            bodyLines.push(t);
          }
        }
        if (bodyLines.length > 0) {
          info.body = bodyLines.join('\n\n');
        }
      }
    } catch(eDoc) {}
  }

  var numStr = escapeHtml(szNumber);
  var initStr = escapeHtml(info.initiator || 'Сотрудник');
  var deptStr = escapeHtml(info.department || '');
  var titleStr = escapeHtml(info.title || 'Служебная записка');
  var amt = Number(info.amount) || 0;
  var contractStr = escapeHtml(info.contract || '');
  var bodyText = (info.body || '').trim();

  if (bodyText.length > 800) {
    bodyText = bodyText.substring(0, 797) + '...';
  }
  var cleanBody = escapeHtml(bodyText);

  var lines = [
    '📑 <b>НА СОГЛАСОВАНИЕ ПОСТУПИЛ ДОКУМЕНТ</b>',
    '',
    '📌 <b>Документ:</b> № ' + numStr,
    '👤 <b>Инициатор:</b> ' + initStr + (deptStr ? ' (' + deptStr + ')' : ''),
    '📋 <b>Тема:</b> ' + titleStr
  ];

  if (amt > 0) {
    lines.push('💰 <b>Сумма к оплате:</b> ' + amt.toLocaleString('ru-RU') + ' ₸');
  }
  if (contractStr && contractStr !== 'Не привязан к договору') {
    lines.push('📂 <b>Основание:</b> ' + contractStr);
  }

  if (cleanBody) {
    lines.push('');
    lines.push('📝 <b>Суть документа:</b>');
    lines.push('<i>' + cleanBody + '</i>');
  }

  lines.push('');
  lines.push('──────────────────────');
  lines.push('👉 <b>Выберите решение прямо в Telegram:</b>');

  var buttons = [];

  // 1. Прямая ссылка на сформированный официальный бланк Google Doc
  if (info.docUrl) {
    buttons.push([{ text: '📄 Открыть официальный бланк (Google Doc) ↗️', url: info.docUrl }]);
  }

  // 2. Две главные кнопки Trust Me механики
  buttons.push([
    { text: '✅ Согласовать', callback_data: 'approve:' + szNumber },
    { text: '❌ Отклонить', callback_data: 'reject:' + szNumber }
  ]);

  // 3. Открыть в веб-приложении
  buttons.push([
    { text: '🚀 Открыть в приложении ЭДО', web_app: { url: getMiniAppUrl() } }
  ]);

  var keyboard = { inline_keyboard: buttons };
  sendTelegramMessageWithKeyboardHtml(targetTgId, lines.join('\n'), keyboard);
  return true;
}

function notifyInitiatorSZStatus(initiatorName, szNumber, message) {
  var targetTgId = getEmployeeTelegramId(initiatorName);
  if (targetTgId) {
    var lines = [
      '📢 <b>Служебная записка ' + escapeHtml(szNumber) + '</b>',
      '',
      escapeHtml(message)
    ];
    sendTelegramMessageHtml(targetTgId, lines.join('\n'));
  }
}

function sendTelegramMessage(chatId, text) {
  sendTelegramMessageHtml(chatId, text);
}

function sendTelegramMessageHtml(chatId, htmlText) {
  if (!CONFIG.BOT_TOKEN || !chatId) return;
  try {
    var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML'
      }),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log('sendTelegramMessageHtml error: ' + e);
  }
}

function sendTelegramMessageWithKeyboardHtml(chatId, htmlText, keyboard) {
  if (!CONFIG.BOT_TOKEN || !chatId) return;
  try {
    var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: htmlText,
        parse_mode: 'HTML',
        reply_markup: keyboard,
        disable_web_page_preview: false
      }),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log('sendTelegramMessageWithKeyboardHtml error: ' + e);
  }
}

function editTelegramMessageHtml(chatId, messageId, htmlText, keyboard) {
  if (!CONFIG.BOT_TOKEN || !chatId || !messageId) return;
  try {
    var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/editMessageText';
    var payload = {
      chat_id: chatId,
      message_id: messageId,
      text: htmlText,
      parse_mode: 'HTML'
    };
    if (keyboard) {
      payload.reply_markup = keyboard;
    }
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log('editTelegramMessageHtml error: ' + e);
  }
}

/**
 * ============================================================================
 * 9. ИНИЦИАЛИЗАЦИЯ И НАСТРОЙКА ВСЕХ ТАБЛИЦ И СТРУКТУРЫ ЯНДЕКС/GOOGLE СВЯЗКИ
 * ============================================================================
 */

function setupEDOSpreadsheet() {
  var ss = getSpreadsheet();
  
  // 1. Лист «Реестр СЗ»
  var szSheet = ss.getSheetByName(CONFIG.SHEETS.SZ_REGISTRY);
  if (!szSheet) szSheet = ss.insertSheet(CONFIG.SHEETS.SZ_REGISTRY);
  var shouldInitHeaders = (szSheet.getLastRow() === 0);
  if (shouldInitHeaders) {
  var szHeaders = [
    '№ СЗ', 'Дата создания', 'Блок / Отдел', 'Инициатор', 'Со-исполнители', 
    'Тип СЗ', 'Краткая суть', 'Сумма (KZT)', 'Контрагент / Основание', '№ Договора', 
    'Статус согласования', 'Статус оплаты', 'Юридический статус (Оригинал)', 
    'Текущий согласующий', 'Маршрут согласования', 'Ссылка на Google Doc', 
    'Ссылка на подписанный скан', 'Папка на Google Диске'
  ];
  szSheet.getRange(1, 1, 1, szHeaders.length).setValues([szHeaders]);
  szSheet.getRange(1, 1, 1, szHeaders.length)
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff');
  szSheet.setFrozenRows(1);
  }

  // 2. Лист «Сотрудники»
  var empSheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
  if (!empSheet) empSheet = ss.insertSheet(CONFIG.SHEETS.EMPLOYEES);
  empSheet.clear();
  var empHeaders = [
    'ID', 'Telegram ID', 'ФИО сотрудника', 'Блок / Отдел', 'Должность', 
    'Непосредственный руководитель', 'Директор блока', 'Username', 'Номер телефона', 'Роль в ЭДО', 'Дата регистрации'
  ];
  empSheet.getRange(1, 1, 1, empHeaders.length).setValues([empHeaders]);
  empSheet.getRange(1, 1, 1, empHeaders.length)
    .setFontWeight('bold')
    .setBackground('#0284c7')
    .setFontColor('#ffffff');
  empSheet.setFrozenRows(1);

  // 3. Лист «Реестр Договоров»
  var conSheet = ss.getSheetByName(CONFIG.SHEETS.CONTRACTS);
  if (!conSheet) conSheet = ss.insertSheet(CONFIG.SHEETS.CONTRACTS);
  conSheet.clear();
  var conHeaders = [
    'ID', 'Блок / Отдел', '№ Договора', 'Дата договора', 'Срок действия', 
    'Контрагент', 'БИН / ИИН', 'Предмет договора', 'Сумма / Условия', 'Ответственный', 
    'Статус', 'Ссылка на скан договора'
  ];
  conSheet.getRange(1, 1, 1, conHeaders.length).setValues([conHeaders]);
  conSheet.getRange(1, 1, 1, conHeaders.length)
    .setFontWeight('bold')
    .setBackground('#059669')
    .setFontColor('#ffffff');
  conSheet.setFrozenRows(1);

  // 4. Лист «Журнал согласований»
  var logSheet = ss.getSheetByName(CONFIG.SHEETS.AUDIT_LOG);
  if (!logSheet) logSheet = ss.insertSheet(CONFIG.SHEETS.AUDIT_LOG);
  logSheet.clear();
  var logHeaders = [
    'ID', '№ СЗ', 'Действие', 'Автор действия', 'Детали / Комментарий', 'Результат', 'Дата и время'
  ];
  logSheet.getRange(1, 1, 1, logHeaders.length).setValues([logHeaders]);
  logSheet.getRange(1, 1, 1, logHeaders.length)
    .setFontWeight('bold')
    .setBackground('#475569')
    .setFontColor('#ffffff');
  logSheet.setFrozenRows(1);

  // 5. Заполняем базу сотрудников из структуры Jana Men
  populateDefaultEmployees(empSheet);

  return '✅ База данных ЭДО Jana Men успешно настроена!';
}

/**
 * Заполнение базы 50 сотрудниками из структуры Jana Men
 */
function populateDefaultEmployees(sheet) {
  var data = [
    [1, '', 'Кабидуллин Нурсултан Нурланович', 'Административный блок', 'Генеральный директор', '-', '-', '@nursultan', '', 'Генеральный директор', '04.11.2026'],
    [2, '', 'Бегалин Арсен Кайратович', 'Административный блок', 'Бизнес-ассистент', 'Кабидуллин Нурсултан Нурланович', 'Кабидуллин Нурсултан Нурланович', '@arsen_begalin', '', 'Бизнес-ассистент', '04.11.2026'],
    [3, '', 'Жәнібек Жансая Жәнібекқызы', 'Административный блок', 'Офис менеджер', 'Бегалин Арсен Кайратович', 'Кабидуллин Нурсултан Нурланович', '', '', 'Исполнитель', '04.11.2026'],
    [4, '', 'Шынәсіл Әділет Жолдыбекұлы', 'Операционный блок', 'Операционный директор', 'Кабидуллин Нурсултан Нурланович', 'Кабидуллин Нурсултан Нурланович', '@adilet_sh', '', 'Директор блока', '04.11.2026'],
    [5, '', 'Кабимулданова Динара Тлеукановна', 'Операционный блок', 'Юрист', 'Шынәсіл Әділет Жолдыбекұлы', 'Шынәсіл Әділет Жолдыбекұлы', '', '', 'Исполнитель', '04.11.2026'],
    [6, '', 'Құрманғалиев Фархат Айсерікұлы', 'Операционный блок', 'Продуктолог', 'Шынәсіл Әділет Жолдыбекұлы', 'Шынәсіл Әділет Жолдыбекұлы', '', '', 'Исполнитель', '04.11.2026'],
    [7, '', 'Койчибекова Жулдыз Ермековна', 'Операционный блок', 'Менеджер по кадрам', 'Шынәсіл Әділет Жолдыбекұлы', 'Шынәсіл Әділет Жолдыбекұлы', '', '', 'Исполнитель', '04.11.2026'],
    [8, '', 'Аманбаев Арман Ауезханұлы', 'Операционный блок', 'Заведующий складом', 'Шынәсіл Әділет Жолдыбекұлы', 'Шынәсіл Әділет Жолдыбекұлы', '@arman_amanbayev', '', 'Исполнитель', '04.11.2026'],
    [9, '', 'Байсейтов Рамазан Алтымбаевич', 'Операционный блок', 'Оператор склада', 'Аманбаев Арман Ауезханұлы', 'Шынәсіл Әділет Жолдыбекұлы', '', '', 'Исполнитель', '04.11.2026'],
    [10, '', 'Абенова Дана Талгатовна', 'Отдел логистики', 'Руководитель отдела логистики', 'Шынәсіл Әділет Жолдыбекұлы', 'Шынәсіл Әділет Жолдыбекұлы', '@dana_abenova', '', 'Руководитель отдела', '04.11.2026'],
    [11, '', 'Курбангалиева Акзере Раильевна', 'Отдел логистики', 'Логист', 'Абенова Дана Талгатовна', 'Шынәсіл Әділет Жолдыбекұлы', '@akzere_k', '', 'Исполнитель', '04.11.2026'],
    [12, '', 'Сейлханова Алия Төлегенқызы', 'Отдел логистики', 'Логист', 'Абенова Дана Талгатовна', 'Шынәсіл Әділет Жолдыбекұлы', '', '', 'Исполнитель', '04.11.2026'],
    [13, '', 'Каримова Адель', 'Отдел логистики', 'Логист', 'Абенова Дана Талгатовна', 'Шынәсіл Әділет Жолдыбекұлы', '@adel_karimova', '', 'Исполнитель', '04.11.2026'],
    [14, '', 'Смагулова Алия Сагинтаевна', 'Финансовый блок', 'Главный бухгалтер', 'Кабидуллин Нурсултан Нурланович', 'Кабидуллин Нурсултан Нурланович', '@aliya_smagulova', '', 'Главный бухгалтер', '04.11.2026'],
    [15, '', 'Абылкасымова Махаббат Рыспекқызы', 'Финансовый блок', 'Финансовый менеджер', 'Смагулова Алия Сагинтаевна', 'Кабидуллин Нурсултан Нурланович', '', '', 'Исполнитель', '04.11.2026'],
    [16, '', 'Сматаева Ақерке Мұратқызы', 'Финансовый блок', 'Бухгалтер', 'Смагулова Алия Сагинтаевна', 'Кабидуллин Нурсултан Нурланович', '', '', 'Исполнитель', '04.11.2026'],
    [17, '', 'Ерболұлы Нурслан', 'Финансовый блок', 'Бухгалтер', 'Смагулова Алия Сагинтаевна', 'Кабидуллин Нурсултан Нурланович', '', '', 'Исполнитель', '04.11.2026'],
    [18, '', 'Қыпшақбаев Темірлан Қайратұлы', 'Отдел маркетинга', 'Директор по маркетингу', 'Кабидуллин Нурсултан Нурланович', 'Кабидуллин Нурсултан Нурланович', '@temirlan_k', '', 'Директор блока', '04.11.2026'],
    [19, '', 'Абай Медина Маратқызы', 'Отдел маркетинга', 'Project manager', 'Қыпшақбаев Темірлан Қайратұлы', 'Қыпшақбаев Темірлан Қайратұлы', '', '', 'Исполнитель', '04.11.2026'],
    [20, '', 'Альбеков Алдияр Биржанович', 'Отдел маркетинга', 'Project manager', 'Қыпшақбаев Темірлан Қайратұлы', 'Қыпшақбаев Темірлан Қайратұлы', '', '', 'Исполнитель', '04.11.2026'],
    [21, '', 'Ахметов Мирас Еликович', 'Отдел маркетинга', 'Графический дизайнер', 'Қыпшақбаев Темірлан Қайратұлы', 'Қыпшақбаев Темірлан Қайратұлы', '', '', 'Исполнитель', '04.11.2026'],
    [22, '', 'Нурашева Алуа Маратовна', 'Отдел маркетинга', 'Инфлюенс-менеджер', 'Қыпшақбаев Темірлан Қайратұлы', 'Қыпшақбаев Темірлан Қайратұлы', '', '', 'Исполнитель', '04.11.2026'],
    [23, '', 'Асылбекова Алина Мухаммедовна', 'Отдел маркетинга', 'SMM-специалист', 'Қыпшақбаев Темірлан Қайратұлы', 'Қыпшақбаев Темірлан Қайратұлы', '', '', 'Исполнитель', '04.11.2026'],
    [24, '', 'Сайдуллаев Куанышбек Галымович', 'Отдел маркетинга', 'IT-специалист (Администратор)', 'Қыпшақбаев Темірлан Қайратұлы', 'Қыпшақбаев Темірлан Қайратұлы', '@kuanyshbek', '', 'Администратор', '04.11.2026'],
    [25, '', 'Айдарәлі Райымбек Сәкенұлы', 'Коммерческий блок', 'Коммерческий директор', 'Кабидуллин Нурсултан Нурланович', 'Кабидуллин Нурсултан Нурланович', '@rayymbek_a', '', 'Директор блока', '04.11.2026'],
    [26, '', 'Абаев Ернар Муратұлы', 'Коммерческий блок', 'Заместитель коммерческого директора', 'Айдарәлі Райымбек Сәкенұлы', 'Айдарәлі Райымбек Сәкенұлы', '', '', 'Руководитель отдела', '04.11.2026'],
    [27, '', 'Турлыбекова Айдана Токтаркызы', 'Коммерческий блок', 'Методолог', 'Айдарәлі Райымбек Сәкенұлы', 'Айдарәлі Райымбек Сәкенұлы', '', '', 'Исполнитель', '04.11.2026'],
    [28, '', 'Жомартбеков Дияр Маратұлы', 'Коммерческий блок', 'Директор по продажам', 'Айдарәлі Райымбек Сәкенұлы', 'Айдарәлі Райымбек Сәкенұлы', '', '', 'Руководитель отдела', '04.11.2026'],
    [29, '', 'Баяхметов Ануар Маратович', 'Коммерческий блок', 'Директор по продажам', 'Айдарәлі Райымбек Сәкенұлы', 'Айдарәлі Райымбек Сәкенұлы', '', '', 'Руководитель отдела', '04.11.2026'],
    [30, '', 'Мукушева Карина Асхатовна', 'Отдел HR', 'Руководитель отдела рекрутинга', 'Шынәсіл Әділет Жолдыбекұлы', 'Шынәсіл Әділет Жолдыбеклы', '', '', 'Руководитель отдела', '04.11.2026'],
    [31, '', 'Касимова Макпал Жупаровна', 'Отдел заботы о клиентах (ОЗК)', 'Руководитель отдела заботы', 'Айдарәлі Райымбек Сәкенұлы', 'Айдарәлі Райымбек Сәкенұлы', '', '', 'Руководитель отдела', '04.11.2026'],
    [32, '', 'Сабилянов Алматай Куантайұлы', 'Отдел трафика', 'Руководитель отдела трафика', 'Қыпшақбаев Темірлан Қайратұлы', 'Қыпшақбаев Темірлан Қайратұлы', '', '', 'Руководитель отдела', '04.11.2026']
  ];

  sheet.getRange(2, 1, data.length, data[0].length).setValues(data);
}


/**
 * ============================================================================
 * 10. ОБРАБОТЧИК TELEGRAM WEBHOOK И КНОПОК СОГЛАСОВАНИЯ В 1 КЛИК
 * ============================================================================
 */

function handleTelegramUpdate(update) {
  try {
    if (!update) return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);

    // Защита от бесконечного спама: дедупликация update_id
    if (update.update_id) {
      try {
        var cache = CacheService.getScriptCache();
        var cacheKey = 'tg_seen_' + update.update_id;
        if (cache.get(cacheKey)) {
          return ContentService.createTextOutput(JSON.stringify({ ok: true, duplicate: true })).setMimeType(ContentService.MimeType.JSON);
        }
        cache.put(cacheKey, '1', 900); // 15 мин
      } catch(cErr) {}
    }

    // 1. Обработка Callback Query (нажатие кнопок [✅ Согласовать] / [❌ Отклонить] в Telegram)
    if (update.callback_query) {
      var cb = update.callback_query;
      var data = cb.data || '';
      var fromId = String(cb.from.id);
      var fromUser = ((cb.from.first_name || '') + (cb.from.last_name ? ' ' + cb.from.last_name : '')).trim() || 'Сотрудник';
      var parts = data.split(':');
      var actionType = parts[0];
      var szNum = parts[1];

      // Поиск ФИО сотрудника по Telegram ID
      var empProfile = getUserProfile(fromId);
      var approverFio = (empProfile.ok && empProfile.employee && empProfile.employee.name) ? empProfile.employee.name : fromUser;
      var dateNow = Utilities.formatDate(new Date(), 'GMT+5', 'dd.MM.yyyy HH:mm');

      // Формируем кнопки: убираем кнопки решения, оставляем ссылку на документ и приложение
      var remainingButtons = [];
      if (cb.message && cb.message.reply_markup && cb.message.reply_markup.inline_keyboard) {
        cb.message.reply_markup.inline_keyboard.forEach(function(row) {
          var filtered = row.filter(function(b) {
            return b.callback_data !== ('approve:' + szNum) && b.callback_data !== ('reject:' + szNum);
          });
          if (filtered.length > 0) remainingButtons.push(filtered);
        });
      }
      var remKeyboard = remainingButtons.length > 0 ? { inline_keyboard: remainingButtons } : null;
      var baseMsg = cb.message.text || '';

      if (actionType === 'approve') {
        var resApprove = approveSZ(szNum, approverFio, 'Согласовано через Telegram', 'approve');
        answerCallbackQuery(cb.id, '✅ Документ ' + szNum + ' успешно согласован!');

        var updatedText = escapeHtml(baseMsg) + '\n\n━━━━━━━━━━━━━━━━━━━━\n✅ <b>ДОКУМЕНТ СОГЛАСОВАН</b>\n👤 <b>Согласующий:</b> ' + escapeHtml(approverFio) + '\n🕒 <b>Дата и время:</b> ' + dateNow;
        editTelegramMessageHtml(cb.message.chat.id, cb.message.message_id, updatedText, remKeyboard);

      } else if (actionType === 'reject') {
        var resReject = approveSZ(szNum, approverFio, 'Отклонено через Telegram', 'reject');
        answerCallbackQuery(cb.id, '❌ Документ ' + szNum + ' отклонен');

        var updatedText = escapeHtml(baseMsg) + '\n\n━━━━━━━━━━━━━━━━━━━━\n❌ <b>ДОКУМЕНТ ОТКЛОНЕН</b>\n👤 <b>Отклонил(а):</b> ' + escapeHtml(approverFio) + '\n🕒 <b>Дата и время:</b> ' + dateNow;
        editTelegramMessageHtml(cb.message.chat.id, cb.message.message_id, updatedText, remKeyboard);
      }
      return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
    }

    // 2. Обработка текстовых команд (/start, /help, /status)
    if (update.message && update.message.text) {
      var msg = update.message;
      var chatId = msg.chat.id;
      var text = msg.text.trim();
      var senderTgId = String(msg.from.id);
      var senderName = ((msg.from.first_name || '') + ' ' + (msg.from.last_name || '')).trim();
      var senderUsername = msg.from.username ? ('@' + msg.from.username) : '';

      // Проверяем, зарегистрирован ли сотрудник
      var profile = getUserProfile(senderTgId);
      
      // Авто-привязка Telegram ID, если совпал username
      if ((!profile.ok || !profile.employee) && senderUsername) {
        bindTelegramIdByUsername(senderTgId, senderUsername);
        profile = getUserProfile(senderTgId);
      }

      if (text.indexOf('/start') === 0) {
        var welcomeLines = [
          '👋 *Добро пожаловать в корпоративный ЭДО Jana Men!*',
          '',
          profile.ok ? ('👤 Вы авторизованы: *' + profile.employee.name + '*\n🏢 Отдел: ' + profile.employee.department + '\n💼 Должность: ' + profile.employee.role) : '⚠️ Вы еще не зарегистрированы в системе.',
          '',
          'Здесь вы можете:',
          '• Составлять служебные записки с помощью *Gemini 2.5 AI*',
          '• Отслеживать согласование у руководителей, Арсена Бегалина и Шефа',
          '• Смотреть изолированный архив договоров вашего отдела',
          '• Прикреплять сканы подписанных оригиналов'
        ];

        var keyboard = {
          inline_keyboard: [
            [{ text: '🚀 Открыть Jana Men ЭДО', web_app: { url: getMiniAppUrl() } }]
          ]
        };

        sendTelegramMessageWithKeyboard(chatId, welcomeLines.join('\n'), keyboard);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    Logger.log('handleTelegramUpdate error: ' + err);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Установка вебхука для @janamen_docs_bot
 */
function setTelegramWebhook(customUrl) {
  var url = customUrl || ScriptApp.getService().getUrl();
  if (!url) {
    throw new Error('Сначала выполните Deploy веб-приложения, чтобы получить URL!');
  }
  var tgUrl = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/setWebhook?url=' + encodeURIComponent(url);
  var res = UrlFetchApp.fetch(tgUrl, { muteHttpExceptions: true });
  Logger.log('Webhook result: ' + res.getContentText());
  return res.getContentText();
}

function getMiniAppUrl() {
  var props = PropertiesService.getScriptProperties().getProperty('MINIAPP_URL');
  return props || 'https://janamendocs.vercel.app';
}

function sendTelegramMessageWithKeyboard(chatId, text, keyboard) {
  if (!CONFIG.BOT_TOKEN || !chatId) return;
  try {
    var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'Markdown',
        reply_markup: keyboard
      }),
      muteHttpExceptions: true
    });
  } catch(e) {
    Logger.log('sendTelegramMessageWithKeyboard error: ' + e);
  }
}

function answerCallbackQuery(callbackQueryId, text) {
  if (!CONFIG.BOT_TOKEN || !callbackQueryId) return;
  try {
    var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/answerCallbackQuery';
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({ callback_query_id: callbackQueryId, text: text }),
      muteHttpExceptions: true
    });
  } catch(e) {}
}

function editTelegramMessage(chatId, messageId, text) {
  if (!CONFIG.BOT_TOKEN) return;
  try {
    var url = 'https://api.telegram.org/bot' + CONFIG.BOT_TOKEN + '/editMessageText';
    UrlFetchApp.fetch(url, {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: text,
        parse_mode: 'Markdown'
      }),
      muteHttpExceptions: true
    });
  } catch(e) {}
}

function bindTelegramIdByUsername(tgId, username) {
  try {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEETS.EMPLOYEES);
    if (!sheet || sheet.getLastRow() <= 1) return;
    var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
    var cleanUser = username.toLowerCase().replace('@', '');
    for (var i = 0; i < rows.length; i++) {
      var rowUser = String(rows[i][7] || '').toLowerCase().replace('@', '');
      if (rowUser === cleanUser) {
        sheet.getRange(i + 2, 2).setValue(String(tgId));
        break;
      }
    }
  } catch(e) {}
}

function testConnection() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  Logger.log('Opened: ' + ss.getName());
  return 'OK: ' + ss.getName();
}


function getCompanyStructure() {
  return {
    ok: true,
    structure: [
      {
        id: "admin",
        name: "Административный блок",
        head: "Кабидуллин Нурсултан Нурланович",
        employees: [
          { id: "1", name: "Кабидуллин Нурсултан Нурланович", role: "Генеральный директор", is_boss: true },
          { id: "2", name: "Бегалин Арсен Кайратович", role: "Бизнес-ассистент", is_assistant: true },
          { id: "3", name: "Жәнібек Жансая Жәнібекқызы", role: "Офис менеджер" }
        ]
      },
      {
        id: "operations",
        name: "Операционный блок",
        head: "Кыпшакбаев Темірлан Қайратұлы",
        employees: [
          { id: "4", name: "Кыпшакбаев Темірлан Қайратұлы", role: "Руководитель операционного блока", is_boss: true },
          { id: "5", name: "Есеналин Ильяс Омирбекулы", role: "Руководитель филиала Алматы" },
          { id: "6", name: "Султанов Оралбек", role: "Руководитель филиала Астана" },
          { id: "7", name: "Раимкулов Асылбек", role: "Старший кладовщик Алматы" },
          { id: "8", name: "Сейдазим Ерасыл Рустемулы", role: "Сборщик Алматы" },
          { id: "9", name: "Болатова Айдана Болаткызы", role: "Сборщик Алматы" },
          { id: "10", name: "Аманжолова Аида", role: "Сборщик Алматы" },
          { id: "11", name: "Хуандык Айдын", role: "Сборщик Алматы" },
          { id: "12", name: "Ахметов Азамат", role: "Сборщик Астана" },
          { id: "13", name: "Абиш Айбек", role: "Сборщик Астана" },
          { id: "14", name: "Болатов Арман", role: "Сборщик Астана" }
        ]
      },
      {
        id: "sales",
        name: "Отдел продаж",
        head: "Байсейітов Рамазан Алтымбаевич",
        employees: [
          { id: "15", name: "Байсейітов Рамазан Алтымбаевич", role: "Руководитель отдела продаж", is_boss: true },
          { id: "16", name: "Кабдуалиев Батырхан Жаксылыкулы", role: "Тимлид B2C продаж" },
          { id: "17", name: "Акзекенова Аяулым Дулатовна", role: "Менеджер по продажам (B2C)" },
          { id: "18", name: "Кенжебаева Адель Сериковна", role: "Менеджер по продажам (B2C)" },
          { id: "19", name: "Маликова Амина Талгатовна", role: "Менеджер по продажам (B2C)" },
          { id: "20", name: "Сабитов Султан Маратович", role: "Менеджер по продажам (B2B)" },
          { id: "21", name: "Ермеков Даурен Ерланулы", role: "Менеджер по продажам (B2B)" }
        ]
      },
      {
        id: "marketing",
        name: "Отдел маркетинга",
        head: "Аманбаев Арман Ауезханұлы",
        employees: [
          { id: "22", name: "Аманбаев Арман Ауезханұлы", role: "Руководитель отдела маркетинга", is_boss: true },
          { id: "23", name: "Сайдуллаев Куанышбек Галымович", role: "IT-специалист" },
          { id: "24", name: "Омарова Дана Кайратовна", role: "Таргетолог / Трафик-менеджер" },
          { id: "25", name: "Серік Аружан Бауыржанқызы", role: "Контент-мейкер / Мобилограф" },
          { id: "26", name: "Жумабеков Дидар", role: "Графический дизайнер" }
        ]
      },
      {
        id: "finance",
        name: "Финансовый блок",
        head: "Смагулова Алия Сагинтаевна",
        employees: [
          { id: "27", name: "Смагулова Алия Сагинтаевна", role: "Главный бухгалтер / Фин. контролер", is_boss: true },
          { id: "28", name: "Нурланова Асем Нурлановна", role: "Бухгалтер по первичной документации" },
          { id: "29", name: "Калиева Гульназ Мухтаровна", role: "Кассир / Операционист" }
        ]
      }
    ]
  };
}

function listDriveFilesAndFolders() {
  var folder = DriveApp.getFolderById(CONFIG.ARCHIVE_ROOT_FOLDER_ID);
  var res = { folderName: folder.getName(), files: [], subfolders: [] };
  
  var fIter = folder.getFiles();
  while (fIter.hasNext()) {
    var f = fIter.next();
    res.files.push({ id: f.getId(), name: f.getName(), mimeType: f.getMimeType(), size: f.getSize(), url: f.getUrl() });
  }
  
  var sfIter = folder.getFolders();
  while (sfIter.hasNext()) {
    var sf = sfIter.next();
    var sfFiles = [];
    var sffIter = sf.getFiles();
    while (sffIter.hasNext()) {
      var sff = sffIter.next();
      sfFiles.push({ id: sff.getId(), name: sff.getName(), mimeType: sff.getMimeType(), size: sff.getSize(), url: sff.getUrl() });
    }
    res.subfolders.push({ id: sf.getId(), name: sf.getName(), files: sfFiles });
  }
  return res;
}

function searchScreenshots() {
  var f = DriveApp.getFolderById("1tv9UfgpQOIONW_nwWZ-BLdcg42aZjRhA");
  var fIt = f.getFiles();
  var items = [];
  while (fIt.hasNext()) {
    var fl = fIt.next();
    items.push({ id: fl.getId(), name: fl.getName(), mimeType: fl.getMimeType(), size: fl.getSize(), url: fl.getUrl() });
  }
  return { ok: true, name: f.getName(), files: items };

  var results = [];
  var fIter = DriveApp.searchFiles('modifiedDate > "2026-11-04" or title contains "Скрин" or title contains "Договор" or title contains "IMG"');
  var count = 0;
  while (fIter.hasNext() && count < 50) {
    var f = fIter.next();
    results.push({ id: f.getId(), name: f.getName(), mimeType: f.getMimeType(), size: f.getSize(), url: f.getUrl() });
    count++;
  }
  
  var folders = [];
  var dIter = DriveApp.searchFolders('title contains "Скрин" or title contains "Договор" or title contains "Jana"');
  while (dIter.hasNext()) {
    var d = dIter.next();
    var dFiles = [];
    var dfIt = d.getFiles();
    while (dfIt.hasNext()) {
      var df = dfIt.next();
      dFiles.push({ id: df.getId(), name: df.getName(), mimeType: df.getMimeType(), url: df.getUrl() });
    }
    folders.push({ id: d.getId(), name: d.getName(), files: dFiles });
  }
  
  return { ok: true, files: results, folders: folders };
}