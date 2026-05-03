/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum SubjectGroup {
  KOREAN = "국어",
  SOCIAL_ETHICS = "사회(역사포함)/도덕",
  MATH = "수학",
  SCIENCE_TECH_INFO = "과학/기술·가정/정보",
  PE = "체육",
  ARTS = "예술(음악,미술)",
  ENGLISH = "영어",
  ELECTIVES = "선택(한문, 중국어, 진로와 직업 등)",
  CREATIVE = "창의적 체험활동",
}

export interface CurriculumHours {
  [SubjectGroup.KOREAN]: number;
  [SubjectGroup.SOCIAL_ETHICS]: number;
  [SubjectGroup.MATH]: number;
  [SubjectGroup.SCIENCE_TECH_INFO]: number;
  [SubjectGroup.PE]: number;
  [SubjectGroup.ARTS]: number;
  [SubjectGroup.ENGLISH]: number;
  [SubjectGroup.ELECTIVES]: number;
  [SubjectGroup.CREATIVE]: number;
}

export interface StudentInfo {
  name: string;
  studentId: string;
  previousSchool: string;
  currentGrade: number;
  transferDate: string; // ISO format or YYYY-MM-DD
}

export interface SemesterData {
  grade: number;
  semester: number;
  hours: Partial<CurriculumHours>;
}

export interface AnalysisResult {
  group: SubjectGroup;
  standard: number; // A
  previousBreakdown: number[]; // B [G1S1...G3S2]
  plannedBreakdown: number[]; // C [G1S1...G3S2]
  total: number; // B + C
  ratio: number; // (B+C)/A * 100
  deficientHours: number;
  needsSupplement: boolean;
}
