//! Parser SSE puro (formato OpenAI, traduzido pelo Worker hat-proxy).
//! Porte do `streaming.rs` legado, desacoplado de Tauri/reqwest: recebe bytes,
//! emite eventos via callback. O buffer é binário para não corromper
//! caracteres UTF-8 multi-byte divididos entre chunks TCP.

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContentType {
    Text,
    Thinking,
}

#[derive(Debug, Clone, PartialEq)]
pub enum SseEvent {
    Delta {
        text: String,
        content_type: ContentType,
    },
    Usage {
        input_tokens: Option<u32>,
        output_tokens: Option<u32>,
    },
    Done,
}

#[derive(Default)]
pub struct SseParser {
    buffer: Vec<u8>,
    in_thoughts: bool,
    finished: bool,
}

impl SseParser {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn is_finished(&self) -> bool {
        self.finished
    }

    /// Consome um chunk de bytes; invoca `f` para cada evento completo.
    pub fn push(&mut self, chunk: &[u8], mut f: impl FnMut(SseEvent)) {
        self.buffer.extend_from_slice(chunk);
        // drain_lines inline: extrai linhas completas, preservando bytes de
        // uma linha incompleta (e de um possível char multi-byte) no buffer.
        while let Some(pos) = self.buffer.iter().position(|b| *b == b'\n') {
            let mut line: Vec<u8> = self.buffer.drain(..=pos).collect();
            line.pop(); // '\n'
            if line.last() == Some(&b'\r') {
                line.pop();
            }
            if self.finished {
                continue;
            }
            if let Ok(s) = std::str::from_utf8(&line) {
                self.handle_line(s.trim(), &mut f);
            }
        }
    }

    fn handle_line(&mut self, line: &str, f: &mut impl FnMut(SseEvent)) {
        if line.is_empty() || line.starts_with(':') {
            return;
        }
        let Some(data) = line.strip_prefix("data: ").or_else(|| line.strip_prefix("data:")) else {
            return;
        };
        if data.trim() == "[DONE]" {
            self.finished = true;
            f(SseEvent::Done);
            return;
        }
        let Ok(json) = serde_json::from_str::<serde_json::Value>(data) else {
            // Chunk malformado não derruba o stream (lição do legado).
            return;
        };

        let content = json["choices"][0]["delta"]["content"].as_str().unwrap_or("");
        if !content.is_empty() {
            self.emit_content(content, f);
        }

        let reasoning = json["choices"][0]["delta"]["reasoning_content"]
            .as_str()
            .unwrap_or("");
        if !reasoning.is_empty() {
            f(SseEvent::Delta {
                text: reasoning.to_string(),
                content_type: ContentType::Thinking,
            });
        }

        if let Some(usage) = json.get("usage") {
            let input_tokens = usage["prompt_tokens"].as_u64().map(|v| v as u32);
            let output_tokens = usage["completion_tokens"].as_u64().map(|v| v as u32);
            if input_tokens.is_some() || output_tokens.is_some() {
                f(SseEvent::Usage {
                    input_tokens,
                    output_tokens,
                });
            }
        }
    }

    /// Separa texto normal de blocos <thoughts>…</thoughts>, tolerando tags
    /// divididas entre deltas? Não: tags podem chegar inteiras por delta (o
    /// Worker não fatia tags), mas um delta pode conter múltiplas transições.
    fn emit_content(&mut self, content: &str, f: &mut impl FnMut(SseEvent)) {
        let mut remaining = content;
        while !remaining.is_empty() {
            if self.in_thoughts {
                if let Some(end) = remaining.find("</thoughts>") {
                    let before = &remaining[..end];
                    if !before.is_empty() {
                        f(SseEvent::Delta {
                            text: before.to_string(),
                            content_type: ContentType::Thinking,
                        });
                    }
                    self.in_thoughts = false;
                    remaining = &remaining[end + "</thoughts>".len()..];
                } else {
                    f(SseEvent::Delta {
                        text: remaining.to_string(),
                        content_type: ContentType::Thinking,
                    });
                    remaining = "";
                }
            } else if let Some(start) = remaining.find("<thoughts>") {
                let before = &remaining[..start];
                if !before.is_empty() {
                    f(SseEvent::Delta {
                        text: before.to_string(),
                        content_type: ContentType::Text,
                    });
                }
                self.in_thoughts = true;
                remaining = &remaining[start + "<thoughts>".len()..];
            } else {
                f(SseEvent::Delta {
                    text: remaining.to_string(),
                    content_type: ContentType::Text,
                });
                remaining = "";
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn collect(parser: &mut SseParser, input: &[u8]) -> Vec<SseEvent> {
        let mut out = Vec::new();
        parser.push(input, |e| out.push(e));
        out
    }

    fn delta(text: &str) -> SseEvent {
        SseEvent::Delta {
            text: text.to_string(),
            content_type: ContentType::Text,
        }
    }

    fn thinking(text: &str) -> SseEvent {
        SseEvent::Delta {
            text: text.to_string(),
            content_type: ContentType::Thinking,
        }
    }

    #[test]
    fn parses_simple_delta() {
        let mut p = SseParser::new();
        let events = collect(
            &mut p,
            b"data: {\"choices\":[{\"delta\":{\"content\":\"ola\"}}]}\n",
        );
        assert_eq!(events, vec![delta("ola")]);
    }

    #[test]
    fn preserves_utf8_split_across_chunks() {
        // "implementação" com o 'ç' (0xC3 0xA7) dividido entre dois chunks.
        let mut p = SseParser::new();
        let full = "data: {\"choices\":[{\"delta\":{\"content\":\"implementação\"}}]}\n";
        let bytes = full.as_bytes();
        let split = full.find("implementa").unwrap() + "implementa".len() + 1; // meio do ç
        let first = collect(&mut p, &bytes[..split]);
        assert!(first.is_empty(), "linha incompleta não emite nada");
        let second = collect(&mut p, &bytes[split..]);
        assert_eq!(second, vec![delta("implementação")]);
    }

    #[test]
    fn strips_crlf() {
        let mut p = SseParser::new();
        let events = collect(
            &mut p,
            b"data: {\"choices\":[{\"delta\":{\"content\":\"x\"}}]}\r\n",
        );
        assert_eq!(events, vec![delta("x")]);
    }

    #[test]
    fn done_marks_finished_and_ignores_rest() {
        let mut p = SseParser::new();
        let events = collect(
            &mut p,
            b"data: [DONE]\ndata: {\"choices\":[{\"delta\":{\"content\":\"tarde\"}}]}\n",
        );
        assert_eq!(events, vec![SseEvent::Done]);
        assert!(p.is_finished());
    }

    #[test]
    fn malformed_json_does_not_kill_stream() {
        let mut p = SseParser::new();
        let events = collect(
            &mut p,
            b"data: {nao-e-json\ndata: {\"choices\":[{\"delta\":{\"content\":\"ok\"}}]}\n",
        );
        assert_eq!(events, vec![delta("ok")]);
    }

    #[test]
    fn splits_thoughts_blocks_within_one_delta() {
        let mut p = SseParser::new();
        let events = collect(
            &mut p,
            b"data: {\"choices\":[{\"delta\":{\"content\":\"a<thoughts>pensando</thoughts>b\"}}]}\n",
        );
        assert_eq!(events, vec![delta("a"), thinking("pensando"), delta("b")]);
    }

    #[test]
    fn thoughts_block_spanning_multiple_deltas() {
        let mut p = SseParser::new();
        let e1 = collect(
            &mut p,
            b"data: {\"choices\":[{\"delta\":{\"content\":\"<thoughts>parte1\"}}]}\n",
        );
        let e2 = collect(
            &mut p,
            b"data: {\"choices\":[{\"delta\":{\"content\":\"parte2</thoughts>resposta\"}}]}\n",
        );
        assert_eq!(e1, vec![thinking("parte1")]);
        assert_eq!(e2, vec![thinking("parte2"), delta("resposta")]);
    }

    #[test]
    fn reasoning_content_maps_to_thinking() {
        let mut p = SseParser::new();
        let events = collect(
            &mut p,
            b"data: {\"choices\":[{\"delta\":{\"reasoning_content\":\"hmm\"}}]}\n",
        );
        assert_eq!(events, vec![thinking("hmm")]);
    }

    #[test]
    fn usage_emits_tokens() {
        let mut p = SseParser::new();
        let events = collect(
            &mut p,
            b"data: {\"choices\":[{\"delta\":{}}],\"usage\":{\"prompt_tokens\":12,\"completion_tokens\":34}}\n",
        );
        assert_eq!(
            events,
            vec![SseEvent::Usage {
                input_tokens: Some(12),
                output_tokens: Some(34)
            }]
        );
    }

    #[test]
    fn comment_and_empty_lines_ignored() {
        let mut p = SseParser::new();
        let events = collect(&mut p, b": keep-alive\n\n");
        assert!(events.is_empty());
    }
}
