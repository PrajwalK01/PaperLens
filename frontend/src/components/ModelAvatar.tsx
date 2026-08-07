interface Props { modelName: string | null | undefined; size?: number }

function provider(m: string) {
  const s = m.toLowerCase()
  if (s.includes('claude'))                    return 'anthropic'
  if (s.includes('gpt') || s.includes('o1') || s.includes('o3')) return 'openai'
  if (s.includes('gemini'))                    return 'google'
  if (s.includes('mistral') || s.includes('mixtral')) return 'mistral'
  if (s.includes('grok'))                      return 'xai'
  return 'unknown'
}

const P: Record<string, { bg: string; label: string }> = {
  anthropic: { bg: '#8B5E3C', label: 'C'  },
  openai:    { bg: '#3C6B5C', label: 'G'  },
  google:    { bg: '#3C5C8B', label: 'Gm' },
  mistral:   { bg: '#7A4030', label: 'M'  },
  xai:       { bg: '#3d2010', label: 'X'  },
  unknown:   { bg: '#442a1b', label: '?'  },
}

export default function ModelAvatar({ modelName, size = 26 }: Props) {
  const p = P[provider(modelName ?? '')]
  return (
    <span title={modelName ?? 'Unknown model'} style={{
      width: size, height: size, borderRadius: '50%', background: p.bg,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size <= 22 ? 8 : 10, fontWeight: 800, color: '#e8c89a', flexShrink: 0,
    }}>
      {p.label}
    </span>
  )
}
