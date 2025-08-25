// Code.gs
// Requiere desplegar en script.google.com. Para hacer el deployment, guarda cambios, deploy > selecciona el deployment activo > edita (lapiz) > desplegable versiones (New version)> Deploy. No hace falta actualizar la variabe GAS_WEBHOOK.
const SCRIPT_SHEET_ID = '1g1E3VczE4E-20rTbIkidW11s9nsbosuUiAmRInkG63A';
const DEST_SHEET_ID      = '1SUZBr844yP56o_H0bKc2WKG5y5GStWOpAZgrLXadH3o';     // ⬅️  ID del spreadsheet destino para leads REtiro
const DEST_TAB_NAME      = 'Leads';            // ⬅️  Nombre de la hoja destino

function doPost(e) {
  if (!e.postData || !e.postData.contents) {
    return ContentService
      .createTextOutput('No hay datos en el POST')
      .setMimeType(ContentService.MimeType.TEXT);
  }
  const d = JSON.parse(e.postData.contents);

  // === Determinar destinatario: email_academia o fallback ===
  const isValidEmail = email =>
    typeof email === 'string' && email.indexOf('@') > 0;
  const to = isValidEmail(d.email_academia)
             ? d.email_academia
             : 'retiro@lacasitadeingles.com';

  // === Construir asunto y cuerpo de email ===
  const subject = `Nuevo lead para Casita ${d.academia} [via retiro.lacasitadeingles.com]`;
  const body = [
    'Un usuario ha completado el formulario de contacto en retiro.lacasitadeingles.com.',
    '',
    `Academia:  ${d.academia}`,
    `Nombre:    ${d.nombre || ''} ${d.apellido || ''}`,
    `Email:     ${d.email || ''}`,
    `Teléfono:  ${d.telefono || ''}`,
    `Año nac.:  ${d.ano || ''}`,
    `Programa:  ${d.program || '-'}`,
    `Newsletter:${d.newsletter ? ' Sí' : ' No'}`,
    `UTM source:${d.utm_source || ''}`,
    `UTM medium:${d.utm_medium || ''}`,
    `UTM campaign:${d.utm_campaign || ''}`,
    `UTM term:  ${d.utm_term || ''}`,
    `UTM content:${d.utm_content || ''}`
  ].join('\n');

  // Enviar email
  MailApp.sendEmail({ to, replyTo: d.email, subject, body });

  // === Registrar en Google Sheets ===
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const ss = SpreadsheetApp.openById(SCRIPT_SHEET_ID);
    let sheet = ss.getSheetByName('Leads');
    if (!sheet) {
      sheet = ss.insertSheet('Leads');
      sheet.appendRow([
        'Fecha',
        'Academia',
        'Nombre',
        'Apellido',
        'Email',
        'Teléfono',
        'Año Nacimiento',
        'Programa',
        'Newsletter',
        'UTM Source',
        'UTM Medium',
        'UTM Campaign',
        'UTM Term',
        'UTM Content',
        'Sent to'
      ]);
    }

    // Prefijar telefonos como texto para respetar ceros iniciales
    const phoneText = `'${d.telefono || ''}`;

    const newRow = [
      new Date(),
      d.academia || '',
      d.nombre || '',
      d.apellido || '',
      d.email || '',
      phoneText,
      d.ano || '',
      d.program || '',
      d.newsletter ? 'Sí' : 'No',
      d.utm_source || '',
      d.utm_medium || '',
      d.utm_campaign || '',
      d.utm_term || '',
      d.utm_content || '',
      to
    ];
    sheet.appendRow(newRow);

    copyIfRetiro(newRow); // Copia a la hoja "Retiro" si corresponde

  } catch (err) {
    console.error('Error al guardar en la hoja: ' + err);
  } finally {
    lock.releaseLock();
  }

  return ContentService
    .createTextOutput('OK')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * Copia la fila al spreadsheet destino si Academia contiene “Retiro”.
 * Coloca los datos en las columnas correctas **buscando el header**,
 * aunque los encabezados estén desordenados o separados.
 *
 * @param {Array} row  Fila recién insertada en la hoja origen.
 */
function copyIfRetiro(row) {
  const academia = (row[1] || '').toString().toLowerCase();
  if (!academia.includes('retiro')) return;          // No es Retiro → salir

  // --- Valores que queremos trasladar ----------------------------------------
  const fieldByHeader = {
    'Parent Name'                 : `${row[2]} ${row[3]}`.trim(),
    'Birth Year'                  : row[6],
    'Program Interested In'       : row[7],
    'Date Of Contact'             : new Date(row[0]),   // objeto Date
    'Phone Number'                : row[5],
    'Email'                       : row[4],
    'Status'                      : 'pte. contactar',
    'Inbound channel'             : 'New web form',
    'Source'                      : row[9],
    'How did they know about us?' : row[11]
  };

  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const destSS  = SpreadsheetApp.openById(DEST_SHEET_ID);
    let destSheet = destSS.getSheetByName(DEST_TAB_NAME);

    // --- Construir la fila en el mismo orden que los encabezados existentes --
    const headers = destSheet
      .getRange(1, 1, 1, destSheet.getLastColumn())
      .getValues()[0];

    // Array con tantos elementos como columnas tiene la hoja destino
    const outRow = headers.map(h => fieldByHeader.hasOwnProperty(h) ? fieldByHeader[h] : '');

    destSheet.appendRow(outRow);

    // --- Formatear fecha y teléfono en su columna real -----------------------
    const lastRow = destSheet.getLastRow();
    const dateCol = headers.indexOf('Date Of Contact') + 1;
    if (dateCol > 0) {
      destSheet.getRange(lastRow, dateCol).setNumberFormat('dd/mm');
    }
    const phoneCol = headers.indexOf('Phone Number') + 1;
    if (phoneCol > 0) {
      destSheet.getRange(lastRow, phoneCol).setNumberFormat('@STRING@');
    }
  } catch (err) {
    console.error('Error al copiar a Retiro sheet: ' + err);
  } finally {
    lock.releaseLock();
  }
}
