import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

const EVIDENCE_DIR = `${RNFS.DocumentDirectoryPath}/audit-evidence`;

async function ensureDir(): Promise<void> {
  const exists = await RNFS.exists(EVIDENCE_DIR);
  if (!exists) await RNFS.mkdir(EVIDENCE_DIR);
}

function generateFilename(prefix: string, ext: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}_${rand}.${ext}`;
}

export async function capturePhoto(): Promise<string | null> {
  await ensureDir();

  return new Promise((resolve) => {
    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        saveToPhotos: false,
      },
      async (response: ImagePickerResponse) => {
        if (response.didCancel || response.errorCode || !response.assets?.[0]?.uri) {
          resolve(null);
          return;
        }

        const sourceUri = response.assets[0].uri;
        const filename = generateFilename('foto', 'jpg');
        const destPath = `${EVIDENCE_DIR}/${filename}`;

        try {
          await RNFS.copyFile(sourceUri.replace('file://', ''), destPath);
          resolve(`file://${destPath}`);
        } catch {
          resolve(sourceUri);
        }
      }
    );
  });
}

export async function pickFromGallery(): Promise<string | null> {
  await ensureDir();

  return new Promise((resolve) => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
      },
      async (response: ImagePickerResponse) => {
        if (response.didCancel || response.errorCode || !response.assets?.[0]?.uri) {
          resolve(null);
          return;
        }

        const sourceUri = response.assets[0].uri;
        const filename = generateFilename('img', 'jpg');
        const destPath = `${EVIDENCE_DIR}/${filename}`;

        try {
          await RNFS.copyFile(sourceUri.replace('file://', ''), destPath);
          resolve(`file://${destPath}`);
        } catch {
          resolve(sourceUri);
        }
      }
    );
  });
}

export async function pickDocument(): Promise<string | null> {
  try {
    const DocumentPicker = require('react-native-document-picker');
    const result = await DocumentPicker.pick({
      type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
    });

    if (!result?.[0]?.uri) return null;

    await ensureDir();
    const sourceUri = result[0].uri;
    const ext = result[0].name?.split('.').pop() || 'pdf';
    const filename = generateFilename('doc', ext);
    const destPath = `${EVIDENCE_DIR}/${filename}`;

    await RNFS.copyFile(sourceUri.replace('file://', ''), destPath);
    return `file://${destPath}`;
  } catch {
    return null;
  }
}

export async function cleanupEvidences(): Promise<void> {
  try {
    const exists = await RNFS.exists(EVIDENCE_DIR);
    if (exists) {
      await RNFS.unlink(EVIDENCE_DIR);
    }
  } catch {
    // ignore cleanup errors
  }
}
