/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const ai = new GoogleGenerativeAI({ apiKey: process.env.GOOGLE_API_KEY });

export async function parseCurriculumFile(base64Data: string, mimeType: string) {
  const prompt = `
    교육과정 편제표 이미지/PDF에서 과목별 '학기 시수 합계'를 추출하세요.
    
    [추출 규칙]
    1. 분석 대상 학기: 1-1, 1-2, 2-1, 2-2, 3-1, 3-2 (총 6개 학기)
    2. 데이터 추출 우선순위: 반드시 '학기 시수 합계', '학기별 시수', '시수(합계)' 등 시수를 의미하는 숫자를 정확히 추출하세요. 
    3. 창의적 체험활동: 반드시 '창의적 체험활동 합계' 행을 찾아 그 전체 합계 시수를 추출하세요. 개별 활동(자율, 동아리 등)의 시수가 아닙니다.
    4. 빈 값: 과목명은 있으나 해당 학기 숫자가 없거나 비어있는 경우 '0'으로 기록하세요.
    5. 과목군: 국어, 수학, 영어, 사회(역사/도덕 포함), 과학(정보/기술·가정 포함), 체육, 예술(음악/미술), 선택(한문/제2외국어/진로 등)을 모두 포함하세요.
    
    데이터가 정확하지 않으면 전입생 처리에 오류가 발생하니 매우 신중하게 숫자를 판독해 주세요.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { data: base64Data, mimeType } }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0,
        candidateCount: 1,
        maxOutputTokens: 2048, // 8192 might be causing issues if thinking takes too much, let's keep it reasonable
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW
        },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subjects: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  hours: {
                    type: Type.ARRAY,
                    items: { type: Type.NUMBER },
                    description: "6 semesters: [1-1, 1-2, 2-1, 2-2, 3-1, 3-2]"
                  }
                },
                required: ["name", "hours"]
              }
            }
          },
          required: ["subjects"]
        }
      }
    });

    let text = response.text;
    if (!text) throw new Error("분석 결과가 비어있습니다.");

    text = text.trim();
    // Remove potential markdown blocks if present
    if (text.startsWith("```")) {
      text = text.replace(/^```[a-z]*\s*/, "").replace(/\s*```$/, "");
    }

    try {
      return JSON.parse(text);
    } catch (parseError) {
      console.error("JSON Parse Error. Length:", text.length, "Text Preview:", text.substring(text.length - 100));
      throw new Error("분석 결과 데이터가 중단되었습니다. 파일 내용을 줄이거나 다시 시도해 주세요.");
    }
  } catch (e: any) {
    const errorMessage = e?.message || e?.statusText || String(e);
    if (errorMessage.includes("429") || errorMessage.includes("RESOURCE_EXHAUSTED") || errorMessage.includes("high demand")) {
      throw new Error("현재 인공지능 서버 부하가 많습니다. 잠시 후(10~30초) 다시 '분석 실행' 버튼을 눌러주세요.");
    }
    
    console.error("Gemini Analysis Error:", e);
    throw new Error("교육과정 분석 중 오류가 발생했습니다. (파일 크기 또는 서버 오류)");
  }
}
