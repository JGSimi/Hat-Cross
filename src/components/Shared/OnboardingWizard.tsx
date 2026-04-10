import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Key, Gem, Bot, Brain, Zap, Shuffle, Globe, Check, Monitor } from 'lucide-react';
import HorseLogo from './HorseLogo';
import { useSettingsStore } from '../../stores/settingsStore';
import { PROVIDER_DEFAULTS, type CloudProvider } from '../../types';
import { fetchModels } from '../../services/ai';

const PROVIDERS: { id: CloudProvider; label: string; icon: React.ReactNode }[] = [
  { id: 'google', label: 'Google Gemini', icon: <Gem size={16} /> },
  { id: 'openai', label: 'OpenAI', icon: <Bot size={16} /> },
  { id: 'anthropic', label: 'Anthropic Claude', icon: <Brain size={16} /> },
  { id: 'openrouter', label: 'OpenRouter', icon: <Shuffle size={16} /> },
  { id: 'inception', label: 'Inception', icon: <Zap size={16} /> },
  { id: 'custom', label: 'Custom', icon: <Globe size={16} /> },
];

type Step = 'welcome' | 'provider' | 'apikey' | 'done';

export default function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider>('google');
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [keyStatus, setKeyStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [useLocal, setUseLocal] = useState(false);

  const { setProvider, setApiKey: storeSetApiKey, updateSettings } = useSettingsStore();

  const handleValidateAndSave = async () => {
    if (!apiKey.trim()) return;
    setValidating(true);
    setKeyStatus('idle');

    storeSetApiKey(selectedProvider, apiKey.trim());
    setProvider(selectedProvider);

    const defaults = PROVIDER_DEFAULTS[selectedProvider];
    const result = await fetchModels(selectedProvider, defaults.defaultEndpoint);

    if (result.length > 0) {
      setKeyStatus('valid');
      setTimeout(() => setStep('done'), 600);
    } else {
      setKeyStatus('invalid');
    }
    setValidating(false);
  };

  const handleUseLocal = () => {
    updateSettings({ inferenceMode: 'local' });
    setStep('done');
  };

  const handleFinish = () => {
    onComplete();
  };

  const slideVariants = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
        backdropFilter: 'blur(30px)',
      }}
    >
      <div style={{
        width: 400,
        maxHeight: '80vh',
        overflow: 'auto',
        padding: 32,
      }}>
        <AnimatePresence mode="wait">
          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <motion.div
              key="welcome"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ textAlign: 'center' }}
            >
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18, delay: 0.1 }}
                style={{ marginBottom: 24 }}
              >
                <HorseLogo size={72} animated />
              </motion.div>

              <h1 style={{
                fontSize: 24, fontWeight: 700, color: 'var(--text-bright)',
                margin: '0 0 8px', letterSpacing: -0.5,
              }}>
                Bem-vindo ao Hat
              </h1>

              <p style={{
                fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
                margin: '0 0 32px',
              }}>
                Seu assistente de IA no menu bar. Configure uma API para
                comecar a conversar.
              </p>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep('provider')}
                style={{
                  padding: '10px 24px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  background: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 2px 12px var(--accent-glow)',
                }}
              >
                Configurar <ArrowRight size={14} />
              </motion.button>
            </motion.div>
          )}

          {/* Step 2: Choose Provider */}
          {step === 'provider' && (
            <motion.div
              key="provider"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <h2 style={{
                fontSize: 18, fontWeight: 700, color: 'var(--text-bright)',
                margin: '0 0 6px', letterSpacing: -0.3,
              }}>
                Escolha o provedor
              </h2>
              <p style={{
                fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px',
              }}>
                Selecione a API de IA que deseja usar.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
                {PROVIDERS.map((p) => (
                  <motion.button
                    key={p.id}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    onClick={() => setSelectedProvider(p.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 14px',
                      borderRadius: 10,
                      fontSize: 12,
                      fontWeight: selectedProvider === p.id ? 600 : 400,
                      background: selectedProvider === p.id
                        ? 'color-mix(in srgb, var(--color-accent) 12%, transparent)'
                        : 'var(--surface-secondary)',
                      color: selectedProvider === p.id ? 'var(--color-accent)' : 'var(--text-secondary)',
                      border: selectedProvider === p.id
                        ? '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)'
                        : '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {p.icon}
                    {p.label}
                    {selectedProvider === p.id && (
                      <Check size={14} style={{ marginLeft: 'auto', color: 'var(--color-accent)' }} />
                    )}
                  </motion.button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStep('apikey')}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    background: 'var(--color-accent)',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  Continuar <ArrowRight size={14} />
                </motion.button>
              </div>

              <button
                onClick={() => { setUseLocal(true); handleUseLocal(); }}
                style={{
                  width: '100%',
                  marginTop: 12,
                  padding: '8px',
                  borderRadius: 8,
                  fontSize: 11,
                  background: 'transparent',
                  color: 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Monitor size={12} /> Usar Ollama local (sem API key)
              </button>
            </motion.div>
          )}

          {/* Step 3: API Key */}
          {step === 'apikey' && (
            <motion.div
              key="apikey"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              <h2 style={{
                fontSize: 18, fontWeight: 700, color: 'var(--text-bright)',
                margin: '0 0 6px', letterSpacing: -0.3,
              }}>
                <Key size={16} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Chave de API
              </h2>
              <p style={{
                fontSize: 12, color: 'var(--text-muted)', margin: '0 0 20px', lineHeight: 1.5,
              }}>
                Insira sua API key do {PROVIDERS.find(p => p.id === selectedProvider)?.label}.
                Sua chave e armazenada localmente e nunca compartilhada.
              </p>

              <div style={{ position: 'relative', marginBottom: 12 }}>
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => { setApiKey(e.target.value); setKeyStatus('idle'); }}
                  placeholder="sk-..."
                  autoFocus
                  aria-label="Chave de API"
                  style={{
                    width: '100%',
                    background: 'var(--input-bg)',
                    color: 'var(--text-primary)',
                    borderRadius: 10,
                    padding: '10px 40px 10px 14px',
                    fontSize: 13,
                    border: keyStatus === 'valid'
                      ? '1px solid var(--success)'
                      : keyStatus === 'invalid'
                      ? '1px solid var(--error)'
                      : '1px solid var(--border-subtle)',
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'border-color 0.15s ease',
                  }}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleValidateAndSave(); }}
                />
                <button
                  onClick={() => setShowKey(!showKey)}
                  aria-label={showKey ? 'Ocultar chave' : 'Mostrar chave'}
                  style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4, display: 'flex',
                  }}
                >
                  {showKey ? '🙈' : '👁'}
                </button>
              </div>

              {keyStatus === 'invalid' && (
                <p style={{
                  fontSize: 11, color: 'var(--error)', margin: '0 0 12px',
                }}>
                  Nao foi possivel validar a chave. Verifique e tente novamente.
                </p>
              )}
              {keyStatus === 'valid' && (
                <p style={{
                  fontSize: 11, color: 'var(--success)', margin: '0 0 12px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <Check size={12} /> Chave validada com sucesso!
                </p>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => setStep('provider')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: 10,
                    fontSize: 12,
                    background: 'var(--surface-secondary)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  Voltar
                </button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleValidateAndSave}
                  disabled={!apiKey.trim() || validating}
                  style={{
                    flex: 1,
                    padding: '10px 20px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 600,
                    background: !apiKey.trim() ? 'var(--surface-secondary)' : 'var(--color-accent)',
                    color: !apiKey.trim() ? 'var(--text-muted)' : 'white',
                    border: 'none',
                    cursor: !apiKey.trim() || validating ? 'default' : 'pointer',
                    opacity: validating ? 0.7 : 1,
                  }}
                >
                  {validating ? 'Validando...' : 'Salvar e continuar'}
                </motion.button>
              </div>

              <p style={{
                fontSize: 10, color: 'var(--text-dim)', marginTop: 16, lineHeight: 1.5, textAlign: 'center',
              }}>
                Voce pode alterar o provedor e a chave a qualquer momento em Configuracoes.
              </p>
            </motion.div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              variants={slideVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              style={{ textAlign: 'center' }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                style={{
                  width: 56, height: 56, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--success) 15%, transparent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Check size={28} style={{ color: 'var(--success)' }} />
              </motion.div>

              <h2 style={{
                fontSize: 20, fontWeight: 700, color: 'var(--text-bright)',
                margin: '0 0 8px',
              }}>
                Tudo pronto!
              </h2>
              <p style={{
                fontSize: 13, color: 'var(--text-muted)', margin: '0 0 8px', lineHeight: 1.5,
              }}>
                {useLocal
                  ? 'Ollama local configurado. Certifique-se de que o Ollama esta rodando.'
                  : `${PROVIDERS.find(p => p.id === selectedProvider)?.label} configurado com sucesso.`
                }
              </p>
              <p style={{
                fontSize: 11, color: 'var(--text-dim)', margin: '0 0 28px', lineHeight: 1.5,
              }}>
                Comece a conversar ou use os atalhos globais para processar o clipboard.
              </p>

              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleFinish}
                style={{
                  padding: '10px 28px',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  background: 'var(--color-accent)',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 12px var(--accent-glow)',
                }}
              >
                Comecar a usar
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
