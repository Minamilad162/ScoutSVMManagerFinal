import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../components/AuthProvider'
import { useScoutYear } from '../components/ScoutYearProvider'
import { LoadingButton } from '../components/ui/LoadingButton'
import { useToast } from '../components/ui/Toaster'
import { getErrorMessage, logError } from '../lib/errors'
import {
  answerKnowledgeQuestion,
  knowledgeSuggestions,
  type KnowledgeAnswer,
} from '../features/knowledgeBank/api'

type HistoryItem = { question: string; answer: KnowledgeAnswer; createdAt: string }

const knowledgeAssets = {
  background: '/knowledge/camp-background.webp',
  panorama: '/knowledge/camp-panorama.webp',
  scoutBoy: '/knowledge/scout-boy-knowledge-navy.webp',
  compass: '/knowledge/compass.webp',
  emblem: '/knowledge/scout-emblem.webp',
  signpost: '/knowledge/signpost.webp',
}

function compactTime(value: string) {
  try {
    return new Intl.DateTimeFormat('ar-EG', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
  } catch {
    return ''
  }
}

function ChatAnswer({ answer }: { answer: KnowledgeAnswer }) {
  return (
    <div className="space-y-3">
      <div>
        <div className="text-base font-black text-slate-950">{answer.title}</div>
        <div className="mt-1 whitespace-pre-line text-sm leading-7 text-slate-600">{answer.message}</div>
      </div>

      {answer.items?.length ? (
        <div className="space-y-2">
          {answer.items.map((item, index) => (
            <div key={`${item.label}-${index}`} className="knowledge-result-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-bold text-slate-400">#{index + 1}</div>
                  <div className="mt-1 break-words text-sm font-black text-slate-900">{item.label}</div>
                </div>
                {item.badge ? <span className="knowledge-soft-pill shrink-0">{item.badge}</span> : null}
              </div>
              {item.value !== undefined ? <div className="mt-2 text-sm font-black text-emerald-800">{item.value}</div> : null}
              {item.note ? <div className="mt-1 text-xs leading-6 text-slate-500">{item.note}</div> : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function KnowledgeBank() {
  const { roles, myTeamId } = useAuth()
  const { currentScoutYear } = useScoutYear()
  const toast = useToast()

  const [question, setQuestion] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)

  const starterSuggestions = useMemo(
    () => knowledgeSuggestions.filter((_, index) => index < 4),
    []
  )

  useEffect(() => {
    const scrollArea = messagesScrollRef.current
    if (!scrollArea) return

    window.requestAnimationFrame(() => {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' })
    })
  }, [history.length, loading])

  async function ask(event?: FormEvent) {
    event?.preventDefault()
    const clean = question.trim()
    if (!clean) {
      toast.error('اكتب السؤال الأول')
      return
    }

    setQuestion('')
    setLoading(true)
    try {
      const result = await answerKnowledgeQuestion({
        question: clean,
        roles,
        myTeamId,
        scoutYearId: currentScoutYear?.id || null,
        scoutYearName: currentScoutYear?.name || null,
      })
      setHistory((prev) => [...prev, { question: clean, answer: result, createdAt: new Date().toISOString() }].slice(-18))
    } catch (error) {
      logError('KnowledgeBank.ask', error as any)
      const msg = getErrorMessage(error as any, 'تعذر تجهيز إجابة آمنة للسؤال')
      const fallback: KnowledgeAnswer = {
        status: 'unsupported',
        title: 'تعذر الإجابة حاليًا',
        message: msg,
      }
      setHistory((prev) => [...prev, { question: clean, answer: fallback, createdAt: new Date().toISOString() }].slice(-18))
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  function askSuggestion(text: string) {
    setQuestion(text)
    window.setTimeout(() => {
      const form = document.getElementById('knowledge-chat-form') as HTMLFormElement | null
      form?.requestSubmit()
    }, 0)
  }

  return (
    <div className="knowledge-chat-page knowledge-camp-chat-page knowledge-asset-chat-page knowledge101-page" dir="rtl">
      <img className="knowledge-bg-photo" src={knowledgeAssets.background} alt="" aria-hidden="true" decoding="async" />
      <div className="knowledge-bg-wash" aria-hidden="true" />
      <img className="knowledge-panorama-layer" src={knowledgeAssets.panorama} alt="" aria-hidden="true" decoding="async" />

      <div className="knowledge-top-scene knowledge-asset-top-scene">
        <div className="knowledge-camp-note knowledge-hand-note hidden lg:block">
          <span>كل سؤال</span>
          <span>يقربك من تجربة</span>
          <strong>أفضل ♡</strong>
        </div>

        <div className="knowledge-hero-copy knowledge-hero-copy-centered knowledge-asset-hero-copy">
          <span className="knowledge-hero-eyebrow">
            <img src={knowledgeAssets.emblem} alt="" aria-hidden="true" decoding="async" />
            بنك المعرفة
          </span>
          <h1>اسأل أي سؤال عن النظام</h1>
          <p>أنا هنا لمساعدتك في استخدام ScoutSVM بكل سهولة</p>
          <div className="knowledge-hero-mini-row">
            <span>معلومات دقيقة</span>
            <span>إجابات سريعة</span>
            <span>حسب صلاحيتك</span>
          </div>
        </div>

        <div className="knowledge-scout-scene knowledge-asset-scout-scene" aria-hidden="true">
          <div className="knowledge-scout-speech knowledge-asset-speech knowledge-scout-speech-c4d">كيف يمكنني مساعدتك اليوم؟</div>
          <div className="knowledge-scout-boy-wrap knowledge-scout-boy-c4d">
            <img className="knowledge-scout-boy" src={knowledgeAssets.scoutBoy} alt="" decoding="async" />
          </div>
          <div className="knowledge-signpost-wrap knowledge-signpost-c4d">
            <img className="knowledge-signpost-img" src={knowledgeAssets.signpost} alt="" decoding="async" />
          </div>
          <span className="knowledge-scout-ray knowledge-scout-ray-one" />
          <span className="knowledge-scout-ray knowledge-scout-ray-two" />
          <span className="knowledge-scout-ray knowledge-scout-ray-three" />
        </div>
      </div>

      <div className="knowledge-chat-layout knowledge-reference-layout knowledge-asset-chat-layout">
        <aside className="knowledge-side-card knowledge-compass-card knowledge-asset-side-card hidden xl:flex">
          <img className="knowledge-compass-image" src={knowledgeAssets.compass} alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <div className="mt-3 text-xl font-black text-slate-900">المعرفة دائمًا معك</div>
          <div className="mt-2 text-sm leading-7 text-slate-600">رحلة كشفية منظمة تبدأ بسؤال واضح وإجابة موثوقة.</div>
          <div className="knowledge-card-landscape knowledge-asset-mini-landscape" aria-hidden="true">
            <img src={knowledgeAssets.panorama} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="mt-auto space-y-2 text-sm font-bold text-slate-700">
            <div>🛡️ إجابات موثوقة</div>
            <div>💬 بلغة بسيطة</div>
            <div>👥 تجربة أفضل للجميع</div>
          </div>
          <div className="knowledge-card-footer">⚜️ نصنع قادة المستقبل</div>
        </aside>

        <section className="knowledge-chat-window knowledge-reference-chat knowledge-asset-chat-window" aria-label="محادثة بنك المعرفة">
          <div className="knowledge-chat-header knowledge-asset-chat-header">
            <div className="flex items-center gap-3">
              <div className="knowledge-bot-avatar knowledge-asset-bot-avatar"><img src={knowledgeAssets.emblem} alt="" aria-hidden="true" /></div>
              <div>
                <div className="text-sm font-black text-slate-900">ScoutSVM مساعد</div>
                <div className="text-xs font-semibold text-slate-500">دائمًا جاهز للإجابة على استفساراتك</div>
              </div>
            </div>
            <span className="knowledge-online-dot">متصل</span>
          </div>

          <div ref={messagesScrollRef} className="knowledge-messages knowledge-scroll-messages knowledge-asset-scroll-messages">
            <div className="knowledge-message-row knowledge-message-bot">
              <div className="knowledge-mini-avatar knowledge-asset-mini-avatar"><img src={knowledgeAssets.emblem} alt="" aria-hidden="true" /></div>
              <div className="knowledge-bubble knowledge-bubble-bot knowledge-asset-welcome-bubble">
                <div className="text-base font-black text-slate-900">أهلًا 👋</div>
                <div className="mt-1 text-sm leading-7 text-slate-600">اكتب سؤالك عن السيستم، وأنا هرد عليك هنا في نفس المحادثة.</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {starterSuggestions.map((item) => (
                    <button key={item} type="button" onClick={() => askSuggestion(item)} className="knowledge-suggestion-chip">
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {history.map((item) => (
              <div key={`${item.createdAt}-${item.question}`} className="space-y-3">
                <div className="knowledge-message-row knowledge-message-user">
                  <div className="knowledge-bubble knowledge-bubble-user">
                    <div className="text-sm leading-7">{item.question}</div>
                    <div className="mt-1 text-[11px] opacity-75">{compactTime(item.createdAt)}</div>
                  </div>
                  <div className="knowledge-mini-avatar knowledge-user-avatar">👤</div>
                </div>

                <div className="knowledge-message-row knowledge-message-bot">
                  <div className="knowledge-mini-avatar knowledge-asset-mini-avatar"><img src={knowledgeAssets.emblem} alt="" aria-hidden="true" /></div>
                  <div className="knowledge-bubble knowledge-bubble-bot">
                    <ChatAnswer answer={item.answer} />
                  </div>
                </div>
              </div>
            ))}

            {loading ? (
              <div className="knowledge-message-row knowledge-message-bot">
                <div className="knowledge-mini-avatar knowledge-asset-mini-avatar"><img src={knowledgeAssets.emblem} alt="" aria-hidden="true" /></div>
                <div className="knowledge-bubble knowledge-bubble-bot knowledge-typing-bubble">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>

          <form id="knowledge-chat-form" onSubmit={ask} className="knowledge-chat-input-bar knowledge-asset-input-bar">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  const form = event.currentTarget.form
                  form?.requestSubmit()
                }
              }}
              rows={1}
              className="knowledge-chat-input"
              placeholder="اكتب سؤالك هنا..."
            />
            <LoadingButton loading={loading} type="submit" className="knowledge-send-button" aria-label="إرسال السؤال">
              ➤
            </LoadingButton>
          </form>
        </section>

        <aside className="knowledge-quote-card knowledge-wisdom-card knowledge-asset-side-card hidden 2xl:flex">
          <div className="knowledge-quote-mark">❝</div>
          <div className="mt-5 text-2xl font-black leading-10 text-slate-900">كل سؤال هو خطوة جديدة نحو التعلم</div>
          <div className="knowledge-card-landscape knowledge-card-landscape-large knowledge-asset-mini-landscape" aria-hidden="true">
            <img src={knowledgeAssets.panorama} alt="" loading="lazy" decoding="async" />
          </div>
          <img className="knowledge-side-emblem" src={knowledgeAssets.emblem} alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <div className="mt-auto text-sm font-bold leading-7 text-slate-600">الكشافة رحلة معرفة وتنمية مستمرة ...</div>
        </aside>
      </div>
    </div>
  )
}
