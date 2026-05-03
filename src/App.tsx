/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  GraduationCap, 
  Upload, 
  Play, 
  AlertCircle, 
  Info,
  Download,
  FileText,
  Table as TableIcon
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { SubjectGroup, StudentInfo, AnalysisResult, CurriculumHours } from "./types.ts";
import { DEFAULT_STANDARDS, SUBJECT_MAPPING } from "./constants.ts";
import { parseCurriculumFile } from "./services/geminiService.ts";

const SEMESTER_LABELS = ["1-1", "1-2", "2-1", "2-2", "3-1", "3-2"];

export default function App() {
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({
    name: "",
    studentId: "",
    previousSchool: "",
    currentGrade: 1,
    transferDate: new Date().toISOString().split("T")[0],
  });

  const [standards, setStandards] = useState<CurriculumHours>(DEFAULT_STANDARDS);

  const [prevFile, setPrevFile] = useState<{name: string, data: string, type: string} | null>(null);
  const [currFile, setCurrFile] = useState<{name: string, data: string, type: string} | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [analysisResults, setAnalysisResults] = useState<AnalysisResult[]>(
    Object.values(SubjectGroup).map(group => ({
      group,
      standard: DEFAULT_STANDARDS[group],
      previousBreakdown: [0, 0, 0, 0, 0, 0],
      plannedBreakdown: [0, 0, 0, 0, 0, 0],
      total: 0,
      ratio: 0,
      deficientHours: 0,
      needsSupplement: true
    }))
  );

  const recalculateResults = (currentResults: AnalysisResult[], currentStandards: CurriculumHours) => {
    return currentResults.map(res => {
      const standard = currentStandards[res.group];
      const prevSum = res.previousBreakdown.reduce((a, b) => a + b, 0);
      const planSum = res.plannedBreakdown.reduce((a, b) => a + b, 0);
      const total = prevSum + planSum;
      const ratio = (total / (standard || 1)) * 100;
      const needsSupplement = ratio < 80;
      const deficientHours = needsSupplement ? Math.max(0, Math.round(standard * 0.8 - total)) : 0;

      return {
        ...res,
        standard,
        total,
        ratio,
        needsSupplement,
        deficientHours
      };
    });
  };

  useEffect(() => {
    setAnalysisResults(prev => recalculateResults(prev, standards));
  }, [standards]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "prev" | "curr") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64String = (event.target?.result as string).split(",")[1];
      const fileData = { name: file.name, data: base64String, type: file.type };
      if (type === "prev") setPrevFile(fileData);
      else setCurrFile(fileData);
    };
    reader.readAsDataURL(file);
  };

  const calculateDaysPassedInSemester = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (month >= 3 && month <= 7) return ((month - 3) * 30) + day;
    if (month >= 8 && month <= 12) return ((month - 8) * 30) + day;
    return 150;
  };

  const getSemesterIndex = (dateStr: string) => {
    const month = new Date(dateStr).getUTCMonth() + 1;
    return (month >= 3 && month <= 7) ? 0 : 1;
  };

  const runAnalysis = async () => {
    if (!prevFile || !currFile) {
      setError("파일을 모두 업로드해주세요. (전출교 편제표 + 본교 편제표)");
      return;
    }
    setError(null);
    setIsAnalyzing(true);

    try {
      const [prevData, currData] = await Promise.all([
        parseCurriculumFile(prevFile.data, prevFile.type),
        parseCurriculumFile(currFile.data, currFile.type)
      ]);

      if (!prevData || !currData) {
        throw new Error("분석 실패. 파일 형식을 확인해주세요.");
      }

      const semesterIdx = (studentInfo.currentGrade - 1) * 2 + getSemesterIndex(studentInfo.transferDate);
      const ratio = Math.min(calculateDaysPassedInSemester(studentInfo.transferDate) / 150, 1);

      const processData = (data: any, isPrevious: boolean) => {
        const breakdown: Record<SubjectGroup, number[]> = {} as Record<SubjectGroup, number[]>;
        Object.values(SubjectGroup).forEach((g) => {
          breakdown[g] = [0, 0, 0, 0, 0, 0];
        });

        if (data?.subjects) {
          data.subjects.forEach((subj: any) => {
            const group = SUBJECT_MAPPING[subj.name] || SUBJECT_MAPPING[Object.keys(SUBJECT_MAPPING).find(k => subj.name.includes(k)) || ""] || null;
            if (group && subj.hours) {
              subj.hours.forEach((h: number, idx: number) => {
                if (idx > 5) return;
                if (isPrevious) {
                  if (idx < semesterIdx) breakdown[group][idx] += h;
                  else if (idx === semesterIdx) breakdown[group][idx] += Math.round(h * ratio);
                } else {
                  if (idx > semesterIdx) breakdown[group][idx] += h;
                  else if (idx === semesterIdx) breakdown[group][idx] += Math.round(h * (1 - ratio));
                }
              });
            }
          });
        }
        return breakdown;
      };

      const bBreakdown = processData(prevData, true);
      const cBreakdown = processData(currData, false);

      const results = Object.values(SubjectGroup).map((group) => ({
          group,
          standard: standards[group],
          previousBreakdown: bBreakdown[group],
          plannedBreakdown: cBreakdown[group],
          total: 0,
          ratio: 0,
          deficientHours: 0,
          needsSupplement: true
      }));

      setAnalysisResults(recalculateResults(results, standards));
    } catch (err: any) {
      setError(err.message || "분석 중 오류가 발생했습니다.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleCellEdit = (group: SubjectGroup, type: "prev" | "plan" | "standard", semIdx: number, value: string) => {
    const numValue = parseInt(value) || 0;
    
    if (type === "standard") {
      setStandards(prev => ({ ...prev, [group]: numValue }));
      return;
    }

    setAnalysisResults(prev => recalculateResults(
      prev.map(row => {
        if (row.group !== group) return row;
        const newPrev = [...row.previousBreakdown];
        const newPlan = [...row.plannedBreakdown];
        if (type === "prev") newPrev[semIdx] = numValue;
        else newPlan[semIdx] = numValue;
        
        return {
          ...row,
          previousBreakdown: newPrev,
          plannedBreakdown: newPlan
        };
      }),
      standards
    ));
  };

  const exportToExcel = () => {
    // 1. Prepare Metadata Rows
    const title = [["전입생 교육과정 이수 시수 분석 결과 보고서"]];
    const info = [
      ["학번/성명", studentInfo.studentId || "-", "", "전출교", studentInfo.previousSchool || "-"],
      ["전입 학년", `${studentInfo.currentGrade}학년`, "", "전입일", studentInfo.transferDate || "-"],
      []
    ];

    // 2. Prepare Header Rows (Double row to match screen)
    const header1 = [
      "과목군", "기준(A)", "합계", "이수율", "보충대상", "미달시간", 
      "전출교 이수 내역 (B)", "", "", "", "", "", 
      "본교 이수 예정 내역 (C)", "", "", "", "", ""
    ];
    const header2 = [
      "", "", "(B+C)", "(%)", "판정", "(시간)", 
      "1-1", "1-2", "2-1", "2-2", "3-1", "3-2",
      "1-1", "1-2", "2-1", "2-2", "3-1", "3-2"
    ];

    // 3. Prepare Data
    const data = analysisResults.map(row => [
      row.group,
      row.standard,
      row.total,
      Math.round(row.ratio),
      row.needsSupplement ? "대상" : "이수",
      row.needsSupplement ? `${row.deficientHours}` : "0",
      ...row.previousBreakdown,
      ...row.plannedBreakdown
    ]);

    // Combine everything
    const rows = [...title, ...info, header1, header2, ...data];
    const ws = XLSX.utils.aoa_to_sheet(rows);

    // 4. Merges & Column Widths
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 17 } }, // Title
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // 과목군
      { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // 기준
      { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // 합계
      { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // 이수율
      { s: { r: 4, c: 4 }, e: { r: 5, c: 4 } }, // 보충대상
      { s: { r: 4, c: 5 }, e: { r: 5, c: 5 } }, // 미달시간
      { s: { r: 4, c: 6 }, e: { r: 4, c: 11 } }, // B header
      { s: { r: 4, c: 12 }, e: { r: 4, c: 17 } }, // C header
    ];

    ws["!cols"] = [
      { wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 },
      ...Array(12).fill({ wch: 6 })
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "전입분석");
    XLSX.writeFile(wb, `전입분석_${studentInfo.studentId || "결과"}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    
    // Translation Mapping for Subject Groups to prevent Korean character corruption in jspdf
    const subjectTranslation: Record<string, string> = {
      "국어": "Korean",
      "사회(역사/도덕 포함)": "Social Studies",
      "수학": "Math",
      "과학/기술·가정/정보": "Science/Tech/Info",
      "체육": "P.E.",
      "예술(음악,미술)": "Arts",
      "영어": "English",
      "선택(한문, 중국어, 진로와 직업 등)": "Electives",
      "창의적 체험활동": "Creative Activities"
    };

    doc.setFontSize(18);
    doc.text("Transfer Student Curriculum Analysis Report", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.text(`Name/ID: ${studentInfo.studentId || "-"}`, 14, 30);
    doc.text(`From (Prev School): ${studentInfo.previousSchool || "-"}`, 14, 35);
    doc.text(`Grade: Year ${studentInfo.currentGrade} | Transfer Date: ${studentInfo.transferDate}`, 14, 40);

    const head = [
      ["Subject Group", "Std(A)", "Total(B+C)", "Rate(%)", "Status", "Deficit", "B(Prev)", "C(Curr)"]
    ];

    const body = analysisResults.map(row => [
      subjectTranslation[row.group] || row.group,
      row.standard,
      row.total,
      `${Math.round(row.ratio)}%`,
      row.needsSupplement ? "Needs Supplement" : "Pass",
      row.needsSupplement ? `${row.deficientHours}h` : "-",
      row.previousBreakdown.join("/"),
      row.plannedBreakdown.join("/")
    ]);

    autoTable(doc, {
      head,
      body,
      startY: 50,
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [44, 62, 80], textColor: 255 },
      columnStyles: {
        0: { cellWidth: 40 },
        6: { cellWidth: 30 },
        7: { cellWidth: 30 }
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY || 50;
    doc.setFontSize(8);
    doc.text("* B: Prev school record / C: Current school plan", 14, finalY + 10);
    doc.text("* This report is generated based on the provided curriculum table data.", 14, finalY + 15);

    doc.save(`Analysis_${studentInfo.studentId || "Result"}.pdf`);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#2D3748] font-sans p-4">
      <div className="max-w-[1700px] mx-auto space-y-4">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-md border border-[#EDF2F7] gap-4">
          <div className="flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-[#4A5568]" />
            <h1 className="text-2xl font-black text-[#1A202C]">전입 분석 전문가</h1>
            <span className="text-xs font-bold text-[#718096] bg-[#F7FAFC] px-3 py-1 rounded-full border border-[#EDF2F7]">전문가 시스템 v2.0</span>
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-6">
            <button 
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className={`px-8 py-3 rounded-xl flex items-center gap-2 font-black text-sm transition-all shadow-lg active:scale-95 ${
                isAnalyzing ? "bg-gray-100 text-gray-400" : "bg-[#4A5568] text-white hover:bg-[#2D3748]"
              }`}
            >
              {isAnalyzing ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              {isAnalyzing ? "분석 중..." : "분석 실행"}
            </button>

            <div className="flex items-center gap-6 ml-8 pl-8 border-l-2 border-gray-100">
               <button 
                onClick={exportToExcel}
                className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-black text-sm hover:bg-green-700 transition-all shadow-md active:scale-95"
              >
                <TableIcon className="w-5 h-5" /> Excel 저장
              </button>
              <button 
                onClick={exportToPDF}
                className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all shadow-md active:scale-95"
              >
                <FileText className="w-5 h-5" /> PDF 저장
              </button>
            </div>
          </div>
        </header>

        {/* Control Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#EDF2F7] space-y-4">
            <div className="flex items-center justify-between">
               <h2 className="text-xs font-black text-[#A0AEC0] uppercase tracking-widest">기본 및 전입 정보</h2>
               <div className="flex items-center gap-1.5 text-[11px] text-blue-500 font-bold">
                 <Info className="w-3 h-3" />
                 분석 실행 전 정보를 확인해주세요
               </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold ml-1">학번/이름</label>
                <input type="text" value={studentInfo.studentId} onChange={(e) => setStudentInfo({...studentInfo, studentId: e.target.value})} placeholder="학번/이름" className="px-3 py-2 bg-[#F7FAFC] rounded-xl text-xs font-bold w-full focus:ring-2 focus:ring-blue-100 outline-none border border-transparent focus:border-blue-200" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold ml-1">전출교</label>
                <input type="text" value={studentInfo.previousSchool} onChange={(e) => setStudentInfo({...studentInfo, previousSchool: e.target.value})} placeholder="전출교명" className="px-3 py-2 bg-[#F7FAFC] rounded-xl text-xs font-bold w-full focus:ring-2 focus:ring-blue-100 outline-none border border-transparent focus:border-blue-200" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold ml-1">전입 학년</label>
                <select value={studentInfo.currentGrade} onChange={(e) => setStudentInfo({...studentInfo, currentGrade: parseInt(e.target.value)})} className="px-3 py-2 bg-[#F7FAFC] rounded-xl text-xs font-bold w-full outline-none border border-transparent focus:border-blue-200 cursor-pointer">
                  <option value={1}>1학년 전입</option>
                  <option value={2}>2학년 전입</option>
                  <option value={3}>3학년 전입</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-400 font-bold ml-1">전입일</label>
                <input type="date" value={studentInfo.transferDate} onChange={(e) => setStudentInfo({...studentInfo, transferDate: e.target.value})} className="px-3 py-2 bg-[#F7FAFC] rounded-xl text-xs font-bold w-full outline-none border border-transparent focus:border-blue-200" />
              </div>
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl shadow-sm border border-[#EDF2F7] space-y-4">
            <h2 className="text-xs font-black text-[#A0AEC0] uppercase tracking-widest px-1">편제표 데이터 추출 (파일 업로드)</h2>
            <div className="flex gap-4">
              <div className={`relative flex-1 py-3 border rounded-2xl text-center transition-all cursor-pointer h-[70px] flex flex-col items-center justify-center gap-1 ${prevFile ? "bg-green-50 border-green-200" : "bg-[#F7FAFC] border-dashed border-[#E2E8F0] hover:bg-white"}`}>
                <input type="file" onChange={(e) => handleFileUpload(e, "prev")} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className={`w-4 h-4 ${prevFile ? "text-green-500" : "text-gray-400"}`} />
                <span className="text-xs font-black">{prevFile ? "전출교 파일 완료" : "전출교 편제표(B)"}</span>
              </div>
              <div className={`relative flex-1 py-3 border rounded-2xl text-center transition-all cursor-pointer h-[70px] flex flex-col items-center justify-center gap-1 ${currFile ? "bg-green-50 border-green-200" : "bg-[#F7FAFC] border-dashed border-[#E2E8F0] hover:bg-white"}`}>
                <input type="file" onChange={(e) => handleFileUpload(e, "curr")} className="absolute inset-0 opacity-0 cursor-pointer" />
                <Upload className={`w-4 h-4 ${currFile ? "text-green-500" : "text-gray-400"}`} />
                <span className="text-xs font-black">{currFile ? "본교 파일 완료" : "본교 편제표(C)"}</span>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm font-bold p-4 rounded-xl border border-red-100 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}

        {/* Results Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-[#EDF2F7] overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#F7FAFC] border-b-2 border-[#EDF2F7] text-xs">
                <th rowSpan={2} className="px-6 py-4 font-black text-[#4A5568] border-r w-[220px] text-center bg-[#FDFCFB]">과목군</th>
                <th rowSpan={2} className="px-3 py-4 font-black text-[#4A5568] border-r text-center w-[80px] bg-[#FDFCFB]">기준(A)</th>
                <th rowSpan={2} className="px-3 py-4 font-black text-blue-700 border-r text-center w-[100px] bg-blue-50/30">이수현황<br/>(B+C)</th>
                <th rowSpan={2} className="px-3 py-4 font-black text-[#4A5568] border-r text-center w-[130px] bg-[#FDFCFB]">보충 대상</th>
                <th colSpan={6} className="px-2 py-2 font-black text-[#4A5568] border-r text-center bg-[#FDFCFB] border-b italic">전출교 이수 내역 (B)</th>
                <th colSpan={6} className="px-2 py-2 font-black text-[#2D3748] border-r last:border-r-0 text-center bg-[#F7FFF9] border-b italic">본교 예정 시수 (C)</th>
              </tr>
              <tr className="bg-[#F7FAFC]/50 border-b border-[#EDF2F7] text-[11px]">
                {SEMESTER_LABELS.map(s => <th key={`b-sub-${s}`} className="px-2 py-2 font-bold border-r text-center bg-[#FDFCFB]/50">{s}</th>)}
                {SEMESTER_LABELS.map(s => <th key={`c-sub-${s}`} className="px-2 py-2 font-bold border-r last:border-r-0 text-center bg-[#F7FFF9]/50">{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {analysisResults.map((row) => {
                const total = row.total;
                const ratio = Math.round(row.ratio);
                return (
                  <tr key={row.group} className="border-b border-[#EDF2F7] last:border-none hover:bg-gray-50/30 transition-colors text-sm">
                    <td className="px-6 py-4 font-black text-[#2D3748] border-r bg-white/50">
                      <div className="leading-normal">{row.group}</div>
                    </td>
                    
                    <td className="px-0 py-0 text-center border-r bg-gray-50/10">
                      <input 
                        type="number" 
                        value={standards[row.group] || ""} 
                        onChange={(e) => handleCellEdit(row.group, "standard", 0, e.target.value)}
                        className="w-full h-full py-4 text-center bg-transparent focus:bg-white outline-none font-black text-gray-500"
                      />
                    </td>
                    
                    <td className="px-3 py-4 text-center border-r bg-blue-50/10">
                      <div className={`text-lg font-black ${row.needsSupplement && total > 0 ? "text-red-500" : (total > 0 ? "text-green-600" : "text-gray-300")}`}>{total}</div>
                      <div className="text-[11px] font-bold text-[#A0AEC0]">{ratio}% 이수</div>
                    </td>

                    <td className="px-3 py-4 text-center border-r">
                      {total === 0 ? <span className="text-gray-200 font-bold">-</span> : (
                        row.needsSupplement ? (
                          <div className="bg-red-50 text-red-600 py-2 rounded-xl text-lg font-black border border-red-100 flex flex-col gap-0.5">
                            <span>보충 필요</span>
                            <span className="opacity-80 opacity-70">미달: {row.deficientHours}시간</span>
                          </div>
                        ) : (
                          <div className="bg-green-50 text-green-600 py-3 rounded-xl text-lg font-black border border-green-100 italic">완료</div>
                        )
                      )}
                    </td>

                    {row.previousBreakdown.map((h, i) => (
                      <td key={`b-${i}`} className="p-0 border-r bg-[#FDFCFB]/10">
                        <input 
                          type="number" 
                          value={h || ""} 
                          onChange={(e) => handleCellEdit(row.group, "prev", i, e.target.value)}
                          placeholder="0"
                          className="w-full h-full py-4 bg-transparent text-center focus:bg-white outline-none font-bold"
                        />
                      </td>
                    ))}

                    {row.plannedBreakdown.map((h, i) => (
                      <td key={`c-${i}`} className="p-0 border-r last:border-r-0 bg-[#F7FFF9]/10">
                        <input 
                          type="number" 
                          value={h || ""} 
                          onChange={(e) => handleCellEdit(row.group, "plan", i, e.target.value)}
                          placeholder="0"
                          className="w-full h-full py-4 bg-transparent text-center focus:bg-white outline-none font-bold"
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend / Info */}
        <div className="flex flex-col md:flex-row gap-4 text-xs font-bold text-[#718096] bg-white p-5 rounded-2xl border border-[#EDF2F7] shadow-sm">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#FDFCFB] border border-[#E2E8F0] rounded-sm"></div>
              <span>B: 전출학교 이수 완료 시수 (또는 전입시기 비례 산출)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-[#F7FFF9] border border-[#C6F6D5] rounded-sm"></div>
              <span>C: 본교 교육과정에 따른 이수 예정 시수</span>
            </div>
          </div>
          <div className="md:ml-auto flex items-center gap-2 text-[#4A5568]">
            <span className="bg-[#EDF2F7] px-3 py-1 rounded-lg">💡 모든 칸의 숫자를 직접 수정하여 시뮬레이션할 수 있습니다.</span>
          </div>
        </div>

        <footer className="text-center text-gray-400 text-xs pt-8 pb-12 font-bold tracking-tight">
          학교 교육과정 전문가. 🌱 소중한 학생들의 성장을 돕습니다.
        </footer>
      </div>
    </div>
  );
}
