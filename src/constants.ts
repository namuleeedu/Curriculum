/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SubjectGroup, CurriculumHours } from "./types.ts";

export const DEFAULT_STANDARDS: CurriculumHours = {
  [SubjectGroup.KOREAN]: 442,
  [SubjectGroup.SOCIAL_ETHICS]: 510,
  [SubjectGroup.MATH]: 374,
  [SubjectGroup.SCIENCE_TECH_INFO]: 680,
  [SubjectGroup.PE]: 272,
  [SubjectGroup.ARTS]: 272,
  [SubjectGroup.ENGLISH]: 340,
  [SubjectGroup.ELECTIVES]: 170,
  [SubjectGroup.CREATIVE]: 306,
};

export const SUBJECT_MAPPING: Record<string, SubjectGroup> = {
  "국어": SubjectGroup.KOREAN,
  // 사회(역사포함)/도덕
  "사회": SubjectGroup.SOCIAL_ETHICS,
  "역사": SubjectGroup.SOCIAL_ETHICS,
  "도덕": SubjectGroup.SOCIAL_ETHICS,
  "한국사": SubjectGroup.SOCIAL_ETHICS,
  "세계사": SubjectGroup.SOCIAL_ETHICS,
  "수학": SubjectGroup.MATH,
  // 과학/기술·가정/정보
  "과학": SubjectGroup.SCIENCE_TECH_INFO,
  "기술": SubjectGroup.SCIENCE_TECH_INFO,
  "가정": SubjectGroup.SCIENCE_TECH_INFO,
  "기술·가정": SubjectGroup.SCIENCE_TECH_INFO,
  "정보": SubjectGroup.SCIENCE_TECH_INFO,
  "체육": SubjectGroup.PE,
  // 음악/미술
  "음악": SubjectGroup.ARTS,
  "미술": SubjectGroup.ARTS,
  "예술": SubjectGroup.ARTS,
  "영어": SubjectGroup.ENGLISH,
  // 선택과목
  "한문": SubjectGroup.ELECTIVES,
  "중국어": SubjectGroup.ELECTIVES,
  "일본어": SubjectGroup.ELECTIVES,
  "진로": SubjectGroup.ELECTIVES,
  "진로와 직업": SubjectGroup.ELECTIVES,
  "생활중국어": SubjectGroup.ELECTIVES,
  "한문I": SubjectGroup.ELECTIVES,
  "생활 외국어": SubjectGroup.ELECTIVES,
  "환경": SubjectGroup.ELECTIVES,
  "보건": SubjectGroup.ELECTIVES,
  // 창의적 체험활동
  "자율": SubjectGroup.CREATIVE,
  "자치": SubjectGroup.CREATIVE,
  "동아리": SubjectGroup.CREATIVE,
  "봉사": SubjectGroup.CREATIVE,
  "창체": SubjectGroup.CREATIVE,
  "창의적 체험활동": SubjectGroup.CREATIVE,
  "창의적체험활동": SubjectGroup.CREATIVE,
  "진로활동": SubjectGroup.CREATIVE,
  "스포츠": SubjectGroup.CREATIVE,
  "스포츠클럽": SubjectGroup.CREATIVE,
  "학교스포츠클럽": SubjectGroup.CREATIVE,
};
