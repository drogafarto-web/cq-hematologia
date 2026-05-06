import React, { useState } from 'react'
import { cn } from '../../../utils/cn'
import { DriveFile } from '../types/SGDDocumento'

type WizardStep = 'auth' | 'select' | 'preview' | 'confirm'

interface DriveImporterWizardProps {
  labId: string
  onComplete: (importedCount: number) => void
  onCancel: () => void
}

/**
 * DriveImporterWizard — 4-step wizard to import documents from Google Drive.
 * 1. Auth: Select Drive folder (via Cloud Function)
 * 2. Select: Choose files from folder
 * 3. Preview: Review selections
 * 4. Confirm: Execute import + show progress
 */
export const DriveImporterWizard: React.FC<DriveImporterWizardProps> = ({
  labId,
  onComplete,
  onCancel
}) => {
  const [step, setStep] = useState<WizardStep>('auth')
  const [driveFolderId, setDriveFolderId] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<DriveFile[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importProgress, setImportProgress] = useState(0)

  const handleSelectFiles = (files: DriveFile[]) => {
    setSelectedFiles(files)
    setStep('preview')
  }

  const handleConfirmImport = async () => {
    setIsImporting(true)
    try {
      // TODO: Call driveImporterService.importBatch()
      // For now, mock progress
      for (let i = 0; i <= 100; i += 10) {
        setImportProgress(i)
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      onComplete(selectedFiles.length)
    } catch (error) {
      console.error('Import failed:', error)
      // TODO: show error toast
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#141417] border border-white/10 rounded-xl w-full max-w-2xl max-h-96 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Importar Documentos do Drive</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Fechar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4 pb-2">
          <div className="flex gap-1">
            {['auth', 'select', 'preview', 'confirm'].map((s, idx) => (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  idx < ['auth', 'select', 'preview', 'confirm'].indexOf(step)
                    ? 'bg-emerald-500'
                    : idx === ['auth', 'select', 'preview', 'confirm'].indexOf(step)
                      ? 'bg-violet-500'
                      : 'bg-white/10'
                )}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4 flex-1 overflow-y-auto">
          {step === 'auth' && (
            <AuthStep
              onNext={(folderId) => {
                setDriveFolderId(folderId)
                setStep('select')
              }}
            />
          )}

          {step === 'select' && (
            <SelectStep
              labId={labId}
              driveFolderId={driveFolderId}
              onNext={handleSelectFiles}
              onPrev={() => setStep('auth')}
            />
          )}

          {step === 'preview' && (
            <PreviewStep
              files={selectedFiles}
              onNext={() => setStep('confirm')}
              onPrev={() => setStep('select')}
            />
          )}

          {step === 'confirm' && (
            <ConfirmStep
              files={selectedFiles}
              isImporting={isImporting}
              progress={importProgress}
              onConfirm={handleConfirmImport}
              onPrev={() => setStep('preview')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// --- Step Components ---

interface AuthStepProps {
  onNext: (folderId: string) => void
}

const AuthStep: React.FC<AuthStepProps> = ({ onNext }) => {
  const [folderId, setFolderId] = useState('')

  return (
    <div className="space-y-4">
      <p className="text-white/80">Selecione a pasta do Google Drive que contém os documentos a importar.</p>
      <div>
        <label className="block text-sm font-medium text-white/80 mb-2">ID da Pasta (Google Drive)</label>
        <input
          type="text"
          value={folderId}
          onChange={(e) => setFolderId(e.target.value)}
          placeholder="1234567890abcdefg..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:border-violet-500"
        />
      </div>
      <button
        onClick={() => onNext(folderId)}
        disabled={!folderId}
        className="w-full bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
      >
        Próximo
      </button>
    </div>
  )
}

interface SelectStepProps {
  labId: string
  driveFolderId: string
  onNext: (files: DriveFile[]) => void
  onPrev: () => void
}

const SelectStep: React.FC<SelectStepProps> = ({ labId, driveFolderId, onNext, onPrev }) => {
  const [files, setFiles] = useState<DriveFile[]>([])
  const [loading, setLoading] = useState(true)

  React.useEffect(() => {
    // TODO: Call sgdDriveImporter() Cloud Function to list files
    // Mock data for now
    setTimeout(() => {
      setFiles([
        {
          id: 'file1',
          name: 'Política_Qualidade.pdf',
          mimeType: 'application/pdf',
          size: 1024000,
          parents: [driveFolderId],
          createdTime: new Date().toISOString(),
          modifiedTime: new Date().toISOString()
        }
      ])
      setLoading(false)
    }, 500)
  }, [driveFolderId])

  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggleFile = (fileId: string) => {
    const newSelected = new Set(selected)
    if (newSelected.has(fileId)) {
      newSelected.delete(fileId)
    } else {
      newSelected.add(fileId)
    }
    setSelected(newSelected)
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          <p className="text-white/80">Selecione os documentos a importar ({selected.size} selecionados)</p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file) => (
              <label key={file.id} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(file.id)}
                  onChange={() => toggleFile(file.id)}
                  className="w-4 h-4 rounded border-white/30 accent-violet-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{file.name}</p>
                  <p className="text-xs text-white/60">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              </label>
            ))}
          </div>
        </>
      )}

      <div className="flex gap-2 pt-4">
        <button
          onClick={onPrev}
          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-lg transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={() => onNext(files.filter((f) => selected.has(f.id)))}
          disabled={selected.size === 0}
          className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
        >
          Próximo
        </button>
      </div>
    </div>
  )
}

interface PreviewStepProps {
  files: DriveFile[]
  onNext: () => void
  onPrev: () => void
}

const PreviewStep: React.FC<PreviewStepProps> = ({ files, onNext, onPrev }) => {
  const [consent, setConsent] = useState(false)

  return (
    <div className="space-y-4">
      <p className="text-white/80">Revise os documentos antes de importar</p>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {files.map((file) => (
          <div key={file.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{file.name}</p>
              <p className="text-xs text-white/60">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        ))}
      </div>

      <label className="flex items-start gap-3 p-3 hover:bg-white/5 rounded-lg cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="w-4 h-4 rounded border-white/30 accent-violet-500 mt-1"
        />
        <p className="text-sm text-white/80">
          Confirmo que estes documentos são adequados para registros laboratoriais e estou de acordo com
          sua importação.
        </p>
      </label>

      <div className="flex gap-2 pt-4">
        <button
          onClick={onPrev}
          className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-lg transition-colors"
        >
          Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!consent}
          className="flex-1 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-lg transition-colors"
        >
          Próximo
        </button>
      </div>
    </div>
  )
}

interface ConfirmStepProps {
  files: DriveFile[]
  isImporting: boolean
  progress: number
  onConfirm: () => void
  onPrev: () => void
}

const ConfirmStep: React.FC<ConfirmStepProps> = ({ files, isImporting, progress, onConfirm, onPrev }) => {
  return (
    <div className="space-y-4">
      {isImporting ? (
        <>
          <p className="text-white/80">Importando {files.length} documentos...</p>
          <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-violet-500 to-emerald-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-white/60 text-center">{progress}%</p>
        </>
      ) : (
        <>
          <p className="text-white/80">Pronto para importar {files.length} documentos</p>
          <div className="flex gap-2 pt-4">
            <button
              onClick={onPrev}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-lg transition-colors"
            >
              Voltar
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 rounded-lg transition-colors"
            >
              Importar Agora
            </button>
          </div>
        </>
      )}
    </div>
  )
}
