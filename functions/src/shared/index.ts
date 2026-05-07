/**
 * Shared helpers and utilities exports
 */

export {
  notivisaFormatter,
  validateNotivisaPayload,
  type NotivisaPayload,
  type LaudoInput,
  type PacienteInput
} from './notivisa';

export {
  smsTemplate,
  emailSubjectCritico,
  emailBodyCritico,
  validateSmsLength,
  type CriticoInput,
  type LabInput,
  type PacienteInput as SmsPacienteInput
} from './sms';

export {
  LaudoDraftManager,
  createLaudoDraftManager,
  type DraftLock,
  type DraftStatus,
  type DraftContent
} from './laudo';

export {
  validateStripImage,
  validateStripImageSafe,
  createStripImage,
  updateStripImage,
  isConfidenceAcceptable,
  getSupportedClasses,
  getConfidenceCategory,
  iaStripValidator,
  type StripImage,
  type StripFeedback
} from './ia';
