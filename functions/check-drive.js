const { google } = require('googleapis');
const key = require('./service-account.json.json');

async function checkDrive() {
  const auth = new google.auth.JWT(
    key.client_email,
    undefined,
    key.private_key,
    ['https://www.googleapis.com/auth/drive']
  );
  await auth.authorize();
  
  const drive = google.drive({ version: 'v3', auth });
  
  // Check storage usage
  const about = await drive.about.get({ fields: 'storageQuota' });
  console.log('Storage quota:', JSON.stringify(about.data.storageQuota, null, 2));
  
  // List files in My Drive
  const files = await drive.files.list({
    q: "'root' in parents and trashed=false",
    fields: 'files(id,name,mimeType)',
    pageSize: 10,
  });
  console.log('Files in root:', files.data.files);
  
  // Try to create a test document
  console.log('\nTrying to create a test document...');
  try {
    const doc = await drive.files.create({
      requestBody: {
        name: 'Test Doc SGQ',
        mimeType: 'application/vnd.google-apps.document',
      },
      fields: 'id,webViewLink',
    });
    console.log('Created doc:', doc.data);
  } catch (err) {
    console.error('Error creating doc:', err.message);
  }
}

checkDrive().catch(console.error);
