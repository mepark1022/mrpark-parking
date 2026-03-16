// @ts-nocheck
"use client";
export const dynamic = 'force-dynamic';

import { useState, useEffect, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import { fmtPlate, splitPlate } from "@/lib/utils/format";
import AppLayout from "@/components/layout/AppLayout";
import MeParkDatePicker from "@/components/ui/MeParkDatePicker";
import { getToday } from "@/lib/utils/date";

const C = {
  navy: "#1428A0", navyLight: "#2d3a8c", gold: "#F5B731", goldLight: "#fef9e7",
  success: "#16A34A", successBg: "#F0FDF4", warning: "#EA580C", warningBg: "#FFF7ED",
  error: "#DC2626", errorBg: "#FEE2E2", purple: "#8b5cf6", purpleBg: "#f5f3ff",
  bgPage: "#f8f9fb", bgCard: "#f4f5f7", border: "#e2e4e9", borderLight: "#eef0f3",
  textPrimary: "#1a1d26", textSecondary: "#5c6370", textMuted: "#8b919d",
};

const typeStyle = (t) => ({
  normal:  { bg: `${C.navy}12`, color: C.navy,    label: "일반" },
  valet:   { bg: "#FFF7ED",     color: "#EA580C",  label: "발렛" },
  monthly: { bg: C.successBg,   color: C.success,  label: "월주차" },
}[t] || { bg: C.bgCard, color: C.textMuted, label: t });

const fmt = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const elapsedStr = (ts) => {
  if (!ts) return null;
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m < 60) return { val: m, unit: "분" };
  const h = Math.floor(m / 60), rm = m % 60;
  return { val: `${h}:${String(rm).padStart(2,"0")}`, unit: "시간" };
};

// 차량번호 JSX 렌더 (한글 뒤 간격)
const PlateText = ({plate, search}: {plate: string, search?: string}) => {
  const [prefix, nums] = splitPlate(plate);
  if (!prefix && !nums) return <>{plate}</>;
  if (search) {
    const q = search.replace(/\s/g,"").toLowerCase();
    const p = (plate||"").replace(/\s/g,"").toLowerCase();
    if (p.includes(q)) {
      const full = prefix + nums;
      const idx = full.toLowerCase().indexOf(q);
      if (idx !== -1) {
        const before = full.slice(0, idx);
        const match = full.slice(idx, idx + q.length);
        const after = full.slice(idx + q.length);
        // 하이라이트된 전체를 prefix/nums 간격 유지하며 표시
        const splitIdx = prefix.length;
        return (
          <span style={{display:"inline-flex",alignItems:"baseline"}}>
            {[before, match, after].map((part, pi) => {
              // 각 파트에서 prefix/nums 경계를 체크해 gap 삽입
              const startPos = pi === 0 ? 0 : pi === 1 ? before.length : before.length + match.length;
              const chars = part.split("").map((ch, ci) => {
                const globalPos = startPos + ci;
                const needGap = globalPos === splitIdx && globalPos > 0;
                return <span key={ci} style={needGap ? {marginLeft:6} : undefined}>{ch}</span>;
              });
              if (pi === 1) return <span key={pi} style={{background:"#FEF08A",borderRadius:3,padding:"0 1px"}}>{chars}</span>;
              return <span key={pi}>{chars}</span>;
            })}
          </span>
        );
      }
    }
  }
  return <span style={{display:"inline-flex",alignItems:"baseline"}}>{prefix}<span style={{marginLeft:6}}>{nums}</span></span>;
};

// 하위 호환용
const hlPlate = (plate, query) => <PlateText plate={plate} search={query} />;

const FilterGroup = ({value,options,onChange}) => (
  <div style={{display:"flex",background:"#fff",borderRadius:10,padding:3,border:`1px solid ${C.borderLight}`}}>
    {options.map(opt=>(
      <button key={opt.id} onClick={()=>onChange(opt.id)} style={{
        padding:"8px 16px",borderRadius:8,border:"none",fontSize:13,
        fontWeight:value===opt.id?700:500,cursor:"pointer",transition:"all 0.2s",
        background:value===opt.id?C.navy:"transparent",
        color:value===opt.id?"#fff":C.textMuted,
      }}>{opt.label}</button>
    ))}
  </div>
);

export default function ParkingStatusPage() {
  const [stores,setStores]=useState([]);
  const [workers,setWorkers]=useState([]);
  const [entries,setEntries]=useState([]);
  const [overdueTickets,setOverdueTickets]=useState([]);
  const [loading,setLoading]=useState(true);
  const [selectedStore,setSelectedStore]=useState("");
  const [selectedDate,setSelectedDate]=useState(getToday());
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [workerFilter,setWorkerFilter]=useState("");
  const [showAll,setShowAll]=useState(false);
  const [activeTab,setActiveTab]=useState("entries"); // entries | overdue
  const [processingId,setProcessingId]=useState<string|null>(null);
  const [plateEditTarget,setPlateEditTarget]=useState<{id:string;plate:string;table:string}|null>(null);
  const [editPlateValue,setEditPlateValue]=useState("");
  const [plateEditLoading,setPlateEditLoading]=useState(false);

  const handleCompleteOverdue = useCallback(async (ticketId: string, waive: boolean) => {
    const label = waive ? "추가요금을 면제하고 출차 처리하시겠습니까?" : "현장 결제 완료로 출차 처리하시겠습니까?";
    if (!confirm(label)) return;
    setProcessingId(ticketId);
    try {
      const res = await fetch("/api/ticket/complete-overdue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, waive }),
      });
      const data = await res.json();
      if (data.success) {
        setOverdueTickets(prev => prev.filter(t => t.id !== ticketId));
      } else {
        alert("처리 실패: " + (data.error || "알 수 없는 오류"));
      }
    } catch {
      alert("네트워크 오류");
    }
    setProcessingId(null);
  }, []);

  const openPlateEdit = (id: string, plate: string, table: string) => {
    setPlateEditTarget({ id, plate, table });
    setEditPlateValue(plate);
  };

  const handlePlateEdit = async () => {
    if (!plateEditTarget) return;
    const cleaned = editPlateValue.trim().toUpperCase().replace(/\s/g, "");
    if (!cleaned || cleaned.length < 4 || cleaned === plateEditTarget.plate) {
      setPlateEditTarget(null);
      return;
    }
    setPlateEditLoading(true);
    const supabase = createClient();
    if (plateEditTarget.table === "parking_entries") {
      const { error } = await supabase.from("parking_entries").update({
        plate_number: cleaned,
      }).eq("id", plateEditTarget.id);
      if (error) { alert("수정 실패: " + error.message); setPlateEditLoading(false); return; }
      setEntries(prev => prev.map(e => e.id === plateEditTarget.id ? { ...e, plate_number: cleaned } : e));
    } else {
      const last4 = cleaned.replace(/[^0-9]/g, "").slice(-4);
      const { error } = await supabase.from("mepark_tickets").update({
        plate_number: cleaned, plate_last4: last4, updated_at: new Date().toISOString(),
      }).eq("id", plateEditTarget.id);
      if (error) { alert("수정 실패: " + error.message); setPlateEditLoading(false); return; }
      setOverdueTickets(prev => prev.map(t => t.id === plateEditTarget.id ? { ...t, plate_number: cleaned } : t));
      setEntries(prev => prev.map(e => e.id === plateEditTarget.id ? { ...e, plate_number: cleaned } : e));
    }
    setPlateEditLoading(false);
    setPlateEditTarget(null);
  };

  useEffect(()=>{loadInitial();},[]);
  useEffect(()=>{loadEntries();},[selectedStore,selectedDate]);

  // Realtime: CREW 입차/출차 시 자동 갱신
  useEffect(()=>{
    const supabase=createClient();
    const channel=supabase.channel("admin-parking-status")
      .on("postgres_changes",{event:"*",schema:"public",table:"mepark_tickets"},()=>{
        loadEntries();
        getUserContext().then(ctx=>{if(ctx.orgId) loadOverdueTickets(ctx.orgId);});
      })
      .on("postgres_changes",{event:"*",schema:"public",table:"parking_entries"},()=>{
        loadEntries();
      })
      .subscribe();
    return ()=>{supabase.removeChannel(channel);};
  },[selectedStore,selectedDate]);

  const loadInitial=async()=>{
    const supabase=createClient();
    const ctx=await getUserContext();
    if(!ctx.orgId) return;
    let q=supabase.from("stores").select("id,name").eq("org_id",ctx.orgId).eq("is_active",true).order("name");
    if(!ctx.allStores&&ctx.storeIds.length>0) q=q.in("id",ctx.storeIds);
    else if(!ctx.allStores){setStores([]);return;}
    const [{data:sd},{data:wd}]=await Promise.all([q,supabase.from("workers").select("id,name").eq("org_id",ctx.orgId).order("name")]);
    setStores(sd||[]);setWorkers(wd||[]);
    loadEntries();
    loadOverdueTickets(ctx.orgId);
  };

  const loadOverdueTickets=async(orgId?: string)=>{
    try{
      // overdue 상태 자동 갱신 먼저 실행
      await fetch("/api/ticket/check-overdue",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orgId})});
      const supabase=createClient();
      const ctx=await getUserContext();
      const oid=orgId||ctx.orgId;
      if(!oid) return;
      const{data}=await supabase.from("mepark_tickets")
        .select("id,plate_number,status,additional_fee,pre_paid_deadline,entry_at,parking_type,stores:store_id(name)")
        .eq("org_id",oid).eq("status","overdue").order("pre_paid_deadline",{ascending:true});
      setOverdueTickets(data||[]);
    }catch(e){console.error("loadOverdueTickets",e);}
  };

  const loadEntries=async()=>{
    setLoading(true);
    const supabase=createClient();
    const ctx=await getUserContext();
    if(!ctx.orgId){setLoading(false);return;}

    // 1) parking_entries (기존 수동입력)
    let q1=supabase.from("parking_entries").select("*,stores(name),workers(name)")
      .gte("entry_time",`${selectedDate}T00:00:00`).lte("entry_time",`${selectedDate}T23:59:59`)
      .order("entry_time",{ascending:false});
    if(selectedStore) q1=q1.eq("store_id",selectedStore);

    // 2) mepark_tickets - 선택한 날짜 입차분
    let q2=supabase.from("mepark_tickets")
      .select("id,plate_number,parking_type,status,entry_at,exit_at,store_id,entry_crew_id,parking_location,is_monthly,is_free,visit_place_id,entry_method,stores:store_id(name),visit_places:visit_place_id(name,floor)")
      .eq("org_id",ctx.orgId)
      .gte("entry_at",`${selectedDate}T00:00:00`).lte("entry_at",`${selectedDate}T23:59:59`)
      .order("entry_at",{ascending:false});
    if(selectedStore) q2=q2.eq("store_id",selectedStore);

    // 3) 날짜 무관 현재 주차 중인 이전 날짜 티켓 (좀비 티켓 — 오늘 날짜에 안 잡힘)
    const todayStart=`${selectedDate}T00:00:00`;
    let q3=supabase.from("mepark_tickets")
      .select("id,plate_number,parking_type,status,entry_at,exit_at,store_id,entry_crew_id,parking_location,is_monthly,is_free,visit_place_id,entry_method,stores:store_id(name),visit_places:visit_place_id(name,floor)")
      .lt("entry_at",todayStart)  // 오늘 이전 날짜만
      .order("entry_at",{ascending:false});
    if(selectedStore) q3=q3.eq("store_id",selectedStore);

    const [{data:peData},{data:mtData},zombieResult]=await Promise.all([q1,q2,q3]);
    const zombieData=zombieResult?.data||[];

    // CREW 이름 조회 (display_name 우선 → name 폴백)
    const crewIds=[...new Set((mtData||[]).map(t=>t.entry_crew_id).filter(Boolean))];
    let crewMap:Record<string,string>={};
    if(crewIds.length>0){
      const{data:profiles}=await supabase.from("profiles").select("id,name,display_name").in("id",crewIds);
      (profiles||[]).forEach(p=>{crewMap[p.id]=p.display_name||p.name||"CREW";});
    }

    // mepark_tickets → parking_entries 형식으로 정규화
    const normalizedTickets=(mtData||[]).map(t=>({
      id: t.id,
      plate_number: t.plate_number,
      parking_type: t.is_monthly ? "monthly" : t.parking_type==="self" ? "normal" : t.parking_type,
      status: ["completed"].includes(t.status) ? "exited" : "parked",
      entry_time: t.entry_at,
      exit_time: t.exit_at,
      store_id: t.store_id,
      worker_id: t.entry_crew_id,
      floor: t.visit_places?.floor || t.parking_location || null,
      stores: t.stores,
      workers: t.entry_crew_id ? { name: crewMap[t.entry_crew_id] || "CREW" } : null,
      entry_method: t.entry_method || null,
      is_free: t.is_free || false,
      _source: "mepark_tickets" as const,
      _ticket_status: t.status, // 원본 티켓 상태 보존
    }));

    // 이전 날짜 좀비 티켓 정규화 (현재 날짜 티켓과 중복 방지)
    const todayTicketIds=new Set((mtData||[]).map(t=>t.id));
    const normalizedZombies=zombieData
      .filter(t=>!todayTicketIds.has(t.id))
      .map(t=>({
        id: t.id,
        plate_number: t.plate_number,
        parking_type: t.is_monthly ? "monthly" : t.parking_type==="self" ? "normal" : t.parking_type,
        status: "parked" as const,
        entry_time: t.entry_at,
        exit_time: t.exit_at,
        store_id: t.store_id,
        worker_id: t.entry_crew_id,
        floor: t.visit_places?.floor || t.parking_location || null,
        stores: t.stores,
        workers: t.entry_crew_id ? { name: crewMap[t.entry_crew_id] || "CREW" } : null,
        entry_method: t.entry_method || null,
        is_free: t.is_free || false,
        _source: "mepark_tickets" as const,
        _ticket_status: t.status,
        _is_zombie: true, // 이전 날짜 미출차 표시
      }));

    const peNormalized=(peData||[]).map(e=>({...e, _source:"parking_entries" as const}));

    // 병합: 좀비 티켓은 맨 위에 표시 (날짜 내림차순)
    const merged=[...normalizedZombies,...peNormalized,...normalizedTickets].sort((a,b)=>{
      // 좀비 먼저
      if((a as any)._is_zombie && !(b as any)._is_zombie) return -1;
      if(!(a as any)._is_zombie && (b as any)._is_zombie) return 1;
      return new Date(b.entry_time).getTime()-new Date(a.entry_time).getTime();
    });
    setEntries(merged);setLoading(false);
  };

  const filtered=useMemo(()=>entries.filter(e=>{
    if(typeFilter!=="all"&&e.parking_type!==typeFilter) return false;
    if(statusFilter!=="all"&&e.status!==statusFilter) return false;
    if(workerFilter&&e.worker_id!==workerFilter) return false;
    if(search){const q=search.replace(/\s/g,"").toLowerCase();const p=(e.plate_number||"").replace(/\s/g,"").toLowerCase();if(!p.includes(q)) return false;}
    return true;
  }),[entries,typeFilter,statusFilter,workerFilter,search]);

  const kpi=useMemo(()=>({
    total:filtered.length,
    parked:filtered.filter(e=>e.status==="parked").length,
    valet:filtered.filter(e=>e.parking_type==="valet").length,
    monthly:filtered.filter(e=>e.parking_type==="monthly").length,
    exited:filtered.filter(e=>e.status==="exited").length,
  }),[filtered]);

  const hourlyData=useMemo(()=>{
    const h={};for(let i=7;i<=22;i++) h[i]=0;
    filtered.forEach(e=>{const hr=new Date(e.entry_time).getHours();if(h[hr]!==undefined) h[hr]++;});
    return Object.entries(h).map(([hr,cnt])=>({hour:Number(hr),count:cnt}));
  },[filtered]);

  const maxHour=Math.max(...hourlyData.map(d=>d.count),1);
  const entryWorkers=workers.filter(w=>[...new Set(entries.map(e=>e.worker_id))].includes(w.id));

  const kpiCards=[
    {icon:"🚗",label:"총 입차",value:kpi.total,unit:"대",color:C.textPrimary,bg:`${C.navy}10`},
    {icon:"🟢",label:"주차중",value:kpi.parked,unit:"대",color:C.success,bg:C.successBg},
    {icon:"🅿️",label:"발렛",value:kpi.valet,unit:"건",color:C.navy,bg:`${C.navy}10`},
    {icon:"⚪",label:"출차",value:kpi.exited,unit:"대",color:C.textMuted,bg:C.bgCard},
  ];

  // 모바일 필터 칩
  const mobileChips = [
    { id:"all",     label:"전체",    count: entries.length },
    { id:"parked",  label:"주차중",  count: entries.filter(e=>e.status==="parked").length,  isStatus:true },
    { id:"exited",  label:"출차",    count: entries.filter(e=>e.status==="exited").length,  isStatus:true },
    { id:"valet",   label:"발렛",    count: entries.filter(e=>e.parking_type==="valet").length, isType:true },
    { id:"monthly", label:"월주차",  count: entries.filter(e=>e.parking_type==="monthly").length, isType:true },
    { id:"overdue", label:"⚠️ 초과", count: overdueTickets.length, isOverdue:true },
  ];
  const activeMobileFilter = activeTab==="overdue" ? "overdue" : statusFilter!=="all" ? statusFilter : typeFilter!=="all" ? typeFilter : "all";
  const handleMobileChip = (id) => {
    if(id==="overdue"){setActiveTab("overdue");loadOverdueTickets();return;}
    setActiveTab("entries");
    const chip = mobileChips.find(c=>c.id===id);
    if(!chip||id==="all"){setStatusFilter("all");setTypeFilter("all");return;}
    if(chip.isStatus){setStatusFilter(id);setTypeFilter("all");}
    else{setTypeFilter(id);setStatusFilter("all");}
  };

  return (
    <AppLayout>
      <style>{`
        @media(max-width:767px){.ps-desktop{display:none!important}.ps-mobile{display:block!important}}
        @media(min-width:768px){.ps-desktop{display:block!important}.ps-mobile{display:none!important}}
      `}</style>

      {/* ─── PC ─── */}
      <div className="ps-desktop" style={{maxWidth:1300}}>

        {/* ─ 탭: 입차현황 / ⚠️ 초과 ─ */}
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          <button onClick={()=>setActiveTab("entries")} style={{
            padding:"10px 22px",borderRadius:10,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",
            background:activeTab==="entries"?C.navy:"#fff",color:activeTab==="entries"?"#fff":C.textMuted,
            border:`1px solid ${activeTab==="entries"?C.navy:C.borderLight}`,
          }}>🚗 입차 현황</button>
          <button onClick={()=>{setActiveTab("overdue");loadOverdueTickets();}} style={{
            padding:"10px 22px",borderRadius:10,border:"none",fontSize:14,fontWeight:700,cursor:"pointer",
            background:activeTab==="overdue"?"#DC2626":"#fff",
            color:activeTab==="overdue"?"#fff":"#DC2626",
            border:`1px solid ${activeTab==="overdue"?"#DC2626":"#fecaca"}`,
            display:"flex",alignItems:"center",gap:8,
          }}>
            ⚠️ 유예시간 초과
            {overdueTickets.length>0&&<span style={{
              background:"#DC2626",color:"#fff",borderRadius:"50%",
              width:20,height:20,display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:11,fontWeight:900,
              ...(activeTab==="overdue"?{background:"rgba(255,255,255,0.3)"}:{})
            }}>{overdueTickets.length}</span>}
          </button>
        </div>

        {/* ─ 초과 탭 내용 ─ */}
        {activeTab==="overdue"&&(
          <div style={{background:"#fff",borderRadius:16,border:"1px solid #fecaca",overflow:"hidden",marginBottom:20,boxShadow:"0 1px 2px rgba(220,38,38,0.06)"}}>
            <div style={{background:"#fff3f3",padding:"16px 24px",borderBottom:"1px solid #fecaca",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:15,fontWeight:800,color:"#DC2626"}}>⚠️ 유예시간 초과 차량</div>
                <div style={{fontSize:12,color:"#999",marginTop:2}}>사전정산 후 유예시간이 초과된 차량입니다. 추가요금 결제가 필요합니다.</div>
              </div>
              <button onClick={()=>loadOverdueTickets()} style={{padding:"8px 16px",borderRadius:8,border:"1px solid #fecaca",background:"#fff",fontSize:13,fontWeight:600,color:"#DC2626",cursor:"pointer"}}>🔄 새로고침</button>
            </div>
            {overdueTickets.length===0?(
              <div style={{textAlign:"center",padding:"48px 0",color:C.textMuted}}>
                <div style={{fontSize:32,marginBottom:8}}>✅</div>
                <div style={{fontSize:14,fontWeight:600}}>유예시간 초과 차량이 없습니다</div>
              </div>
            ):(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    {["차량번호","매장","유형","입차시간","사전정산 마감","초과 시간","추가요금","티켓 링크","출차 처리"].map(h=>(
                      <th key={h} style={{padding:"12px 16px",textAlign:"left",fontSize:12,fontWeight:600,color:C.textMuted,background:"#fef2f2",borderBottom:"1px solid #fecaca"}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {overdueTickets.map((t,i)=>{
                    const overdueMs=t.pre_paid_deadline?Date.now()-new Date(t.pre_paid_deadline).getTime():0;
                    const overdueMin=Math.ceil(overdueMs/60000);
                    return(
                      <tr key={t.id} style={{background:i%2===0?"#fff":"#fff8f8"}}>
                        <td style={{padding:"12px 16px",fontSize:15,fontWeight:900,color:"#1A1D2B",letterSpacing:0.3,borderBottom:"1px solid #fef2f2"}}>
                          <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                            <PlateText plate={t.plate_number} />
                            <button onClick={()=>openPlateEdit(t.id,t.plate_number,"mepark_tickets")}
                              style={{width:22,height:22,borderRadius:"50%",border:"1px solid #fecaca",background:"#fff5f5",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0}}
                              title="차량번호 수정">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                            </button>
                          </span>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:C.textSecondary,borderBottom:"1px solid #fef2f2"}}>{t.stores?.name||"-"}</td>
                        <td style={{padding:"12px 16px",borderBottom:"1px solid #fef2f2"}}>
                          <span style={{padding:"3px 10px",borderRadius:5,fontSize:12,fontWeight:700,
                            background:t.parking_type==="valet"?"#fff7ed":"#eef2ff",
                            color:t.parking_type==="valet"?"#EA580C":"#1428A0"
                          }}>{t.parking_type==="valet"?"발렛":"일반"}</span>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:13,color:C.textSecondary,borderBottom:"1px solid #fef2f2"}}>{t.entry_at?new Date(t.entry_at).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}):"-"}</td>
                        <td style={{padding:"12px 16px",fontSize:13,color:"#DC2626",fontWeight:600,borderBottom:"1px solid #fef2f2"}}>{t.pre_paid_deadline?new Date(t.pre_paid_deadline).toLocaleTimeString("ko-KR",{hour:"2-digit",minute:"2-digit"}):"-"}</td>
                        <td style={{padding:"12px 16px",borderBottom:"1px solid #fef2f2"}}>
                          <span style={{background:"#fee2e2",color:"#DC2626",padding:"3px 10px",borderRadius:5,fontSize:13,fontWeight:800}}>{overdueMin}분 초과</span>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:14,fontWeight:800,color:"#DC2626",borderBottom:"1px solid #fef2f2"}}>{(t.additional_fee||0).toLocaleString()}원</td>
                        <td style={{padding:"12px 16px",borderBottom:"1px solid #fef2f2"}}>
                          <a href={`/ticket/${t.id}`} target="_blank" rel="noopener noreferrer"
                            style={{padding:"5px 12px",borderRadius:6,border:"1px solid #1428A0",background:"#eef2ff",color:"#1428A0",fontSize:12,fontWeight:700,textDecoration:"none",display:"inline-block"}}>
                            🔗 티켓
                          </a>
                        </td>
                        <td style={{padding:"12px 16px",borderBottom:"1px solid #fef2f2"}}>
                          <div style={{display:"flex",gap:6,flexWrap:"nowrap"}}>
                            <button
                              onClick={()=>handleCompleteOverdue(t.id,false)}
                              disabled={processingId===t.id}
                              style={{padding:"5px 10px",borderRadius:6,border:"none",background:"#1428A0",color:"#fff",fontSize:11,fontWeight:700,cursor:processingId===t.id?"not-allowed":"pointer",whiteSpace:"nowrap",opacity:processingId===t.id?0.6:1}}
                            >
                              {processingId===t.id?"처리중...":"💳 결제완료"}
                            </button>
                            <button
                              onClick={()=>handleCompleteOverdue(t.id,true)}
                              disabled={processingId===t.id}
                              style={{padding:"5px 10px",borderRadius:6,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:11,fontWeight:700,cursor:processingId===t.id?"not-allowed":"pointer",whiteSpace:"nowrap",opacity:processingId===t.id?0.6:1}}
                            >
                              면제출차
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ─ 기존 입차현황 (activeTab === "entries" 일 때만) ─ */}
        {activeTab==="entries"&&(<>
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.borderLight}`,boxShadow:"0 1px 2px rgba(0,0,0,0.04)",marginBottom:20}}>
          <div style={{padding:"16px 24px",display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <select value={selectedStore} onChange={e=>setSelectedStore(e.target.value)}
                style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,fontWeight:600,background:"#fff",minWidth:140,flex:1}}>
                <option value="">전체 매장</option>
                {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <MeParkDatePicker value={selectedDate} onChange={setSelectedDate} style={{flex:1}} />
              <select value={workerFilter} onChange={e=>setWorkerFilter(e.target.value)}
                style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,background:"#fff",minWidth:120}}>
                <option value="">전체 등록자</option>
                {entryWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:10,
                border:search?`2px solid ${C.navy}`:`1px solid ${C.border}`,padding:"0 14px",
                minWidth:200,flex:1,maxWidth:360,transition:"border-color 0.2s"}}>
                <span style={{fontSize:15,color:C.textMuted}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="차량번호 검색"
                  style={{flex:1,border:"none",outline:"none",background:"none",fontSize:14,fontWeight:600,padding:"10px 0",color:C.textPrimary}} />
                {search&&<button onClick={()=>setSearch("")} style={{border:"none",background:C.errorBg,borderRadius:8,width:36,height:36,cursor:"pointer",fontSize:12,color:C.error,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
              </div>
              <div style={{marginLeft:"auto",fontSize:13,color:C.textMuted,background:C.bgCard,padding:"8px 14px",borderRadius:8,whiteSpace:"nowrap"}}>
                검색 결과 <strong style={{color:C.navy,marginLeft:4}}>{filtered.length}건</strong>
              </div>
            </div>
          </div>
          </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
          {kpiCards.map(k=>(
            <div key={k.label} style={{background:"#fff",borderRadius:16,padding:"20px 22px",border:`1px solid ${C.borderLight}`,boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
              <div style={{width:44,height:44,borderRadius:12,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:14}}>{k.icon}</div>
              <div style={{fontSize:28,fontWeight:800,color:k.color,lineHeight:1}}>
                {k.value.toLocaleString()}<span style={{fontSize:14,fontWeight:600,color:C.textMuted,marginLeft:4}}>{k.unit}</span>
              </div>
              <div style={{fontSize:13,color:C.textMuted,marginTop:6}}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:20,marginBottom:24,alignItems:"start"}}>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            <FilterGroup value={typeFilter} onChange={setTypeFilter}
              options={[{id:"all",label:"전체"},{id:"normal",label:"일반"},{id:"valet",label:"발렛"},{id:"monthly",label:"월주차"}]} />
            <FilterGroup value={statusFilter} onChange={setStatusFilter}
              options={[{id:"all",label:"전체"},{id:"parked",label:"🟢 주차중"},{id:"exited",label:"⚪ 출차"}]} />
          </div>
          <div style={{background:"#fff",borderRadius:16,padding:"16px 20px",border:`1px solid ${C.borderLight}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.textPrimary}}>⏰ 시간대별 입차</div>
              <div style={{fontSize:12,color:C.textMuted,background:C.bgCard,padding:"4px 10px",borderRadius:6}}>
                <strong style={{color:C.navy}}>{filtered.length}</strong>건
              </div>
            </div>
            <div style={{display:"flex",alignItems:"flex-end",gap:3,height:80}}>
              {hourlyData.map((d,i)=>{
                const h=Math.max((d.count/maxHour)*100,4);
                const isPeak=d.count===maxHour&&d.count>0;
                return(
                  <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                    <span style={{fontSize:9,fontWeight:700,color:isPeak?C.navy:C.textMuted}}>{d.count||""}</span>
                    <div style={{width:"100%",maxWidth:24,height:`${h}%`,borderRadius:"4px 4px 0 0",background:isPeak?C.navy:d.count>0?`${C.navy}50`:C.bgCard}} />
                    <span style={{fontSize:9,color:C.textMuted}}>{d.hour}시</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.borderLight}`,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
          {loading?(
            <div style={{textAlign:"center",padding:"60px 0",color:C.textMuted,fontSize:15}}>⏳ 로딩 중...</div>
          ):filtered.length===0?(
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:44,marginBottom:12}}>🔍</div>
              <div style={{fontSize:16,fontWeight:700,color:C.textPrimary,marginBottom:6}}>
                {entries.length===0?(statusFilter==="exited"?"출차 데이터가 없습니다":"입차 데이터가 없습니다"):"검색 결과가 없습니다"}
              </div>
              <div style={{fontSize:13,color:C.textMuted}}>
                {entries.length===0?"크루앱에서 입차를 등록하면 여기에 표시됩니다":"필터를 변경해 보세요"}
              </div>
            </div>
          ):(
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  {["차량번호","매장","유형","입차방식","입차시간","출차시간","위치","등록자","무료","상태"].map(h=>(
                    <th key={h} style={{padding:"14px 16px",textAlign:"left",fontSize:13,fontWeight:600,color:C.textMuted,background:C.bgCard,borderBottom:`1px solid ${C.borderLight}`}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(showAll ? filtered : filtered.slice(0,50)).map((e,i)=>{
                  const ts=typeStyle(e.parking_type);
                  const isParked=e.status==="parked";
                  return(
                    <tr key={e.id} style={{background:i%2===0?"#fff":C.bgPage}}>
                      <td style={{padding:"12px 16px",fontSize:15,fontWeight:800,color:C.textPrimary,letterSpacing:0.3,borderBottom:`1px solid ${C.borderLight}`}}>
                        <span style={{display:"inline-flex",alignItems:"center",gap:6}}>
                          {hlPlate(e.plate_number,search)}
                          {e.status==="parked"&&(
                            <button onClick={()=>openPlateEdit(e.id,e.plate_number,e._source||"parking_entries")}
                              style={{width:22,height:22,borderRadius:"50%",border:`1px solid ${C.borderLight}`,background:"#f8fafc",cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}
                              title="차량번호 수정">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                            </button>
                          )}
                        </span>
                      </td>
                      <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:C.textSecondary,borderBottom:`1px solid ${C.borderLight}`,maxWidth:140,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.stores?.name||"-"}</td>
                      <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                        <span style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:700,background:ts.bg,color:ts.color}}>{ts.label}</span>
                      </td>
                      <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                        {e.entry_method ? (
                          <span style={{padding:"3px 10px",borderRadius:6,fontSize:11,fontWeight:700,
                            background:e.entry_method==="camera"?"#EFF6FF":"#F1F5F9",
                            color:e.entry_method==="camera"?"#1D4ED8":"#64748B"}}>
                            {e.entry_method==="camera"?"📷 카메라":"✏️ 수기"}
                          </span>
                        ) : <span style={{fontSize:12,color:C.textMuted}}>-</span>}
                      </td>
                      <td style={{padding:"12px 16px",fontSize:14,fontWeight:700,color:C.textPrimary,borderBottom:`1px solid ${C.borderLight}`}}>{fmt(e.entry_time)}</td>
                      <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:e.exit_time?C.textSecondary:C.textMuted,borderBottom:`1px solid ${C.borderLight}`}}>{fmt(e.exit_time)}</td>
                      <td style={{padding:"12px 16px",fontSize:12,color:C.textMuted,borderBottom:`1px solid ${C.borderLight}`}}>{e.floor||"-"}</td>
                      <td style={{padding:"12px 16px",fontSize:13,fontWeight:500,color:C.textSecondary,borderBottom:`1px solid ${C.borderLight}`}}>{e.workers?.name||"-"}</td>
                      <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                        {e._source==="mepark_tickets" ? (
                          <button
                            title={e.is_free ? "무료 해제" : "무료 처리"}
                            onClick={async()=>{
                              const supabase=createClient();
                              const newVal=!e.is_free;
                              const{error}=await supabase.from("mepark_tickets").update({is_free:newVal}).eq("id",e.id);
                              if(!error) setEntries(prev=>prev.map(x=>x.id===e.id?{...x,is_free:newVal}:x));
                            }}
                            style={{
                              padding:"4px 10px",borderRadius:6,fontSize:12,fontWeight:700,cursor:"pointer",
                              border:"none",transition:"all 0.2s",
                              background:e.is_free?"#F0FDF4":"#F1F5F9",
                              color:e.is_free?"#16A34A":"#94A3B8",
                            }}>
                            {e.is_free?"🆓 무료":"유료"}
                          </button>
                        ):<span style={{fontSize:12,color:C.textMuted}}>-</span>}
                      </td>
                      <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                        <span style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:700,background:isParked?C.successBg:C.bgCard,color:isParked?C.success:C.textMuted}}>
                          {isParked?"● 주차중":"출차"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          {!showAll && filtered.length>50&&(
            <div
              onClick={()=>setShowAll(true)}
              style={{textAlign:"center",padding:"14px 0",borderTop:`1px solid ${C.borderLight}`,fontSize:13,fontWeight:700,color:C.navy,cursor:"pointer",background:"#f8faff",transition:"background 0.15s"}}
              onMouseEnter={e=>(e.currentTarget.style.background="#eef2ff")}
              onMouseLeave={e=>(e.currentTarget.style.background="#f8faff")}
            >
              ▼ 나머지 {filtered.length-50}건 더보기
            </div>
          )}
          {showAll && filtered.length>50&&(
            <div
              onClick={()=>setShowAll(false)}
              style={{textAlign:"center",padding:"14px 0",borderTop:`1px solid ${C.borderLight}`,fontSize:13,fontWeight:700,color:C.textMuted,cursor:"pointer",background:"#f8faff",transition:"background 0.15s"}}
              onMouseEnter={e=>(e.currentTarget.style.background="#f1f5f9")}
              onMouseLeave={e=>(e.currentTarget.style.background="#f8faff")}
            >
              ▲ 접기
            </div>
          )}
        </div>
        </>) } {/* end activeTab==="entries" */}
      </div>

      {/* ─── 모바일 ─── */}
      <div className="ps-mobile" style={{margin:"-16px -16px 0",paddingBottom:100}}>

        {/* 플로우 바 */}
        <div style={{background:"linear-gradient(160deg,#1428A0 0%,#0d1d7a 100%)",padding:"12px 16px 14px"}}>
          <div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.4)",letterSpacing:"1px",textTransform:"uppercase",marginBottom:10}}>
            입차 → 출차 흐름
          </div>
          <div style={{display:"flex",alignItems:"center"}}>
            {[
              { emoji:"🅿️", label:"주차중",  count: entries.filter(e=>e.status==="parked").length,   borderColor:"#3b5bdb" },
              { emoji:"🚗", label:"발렛",    count: entries.filter(e=>e.parking_type==="valet"&&e.status==="parked").length, borderColor:"#fb923c", accent:true },
              { emoji:"🏆", label:"월주차",  count: entries.filter(e=>e.parking_type==="monthly").length, borderColor:"#22c55e" },
              { emoji:"🏁", label:"오늘출차", count: entries.filter(e=>e.status==="exited").length,  borderColor:"#6b7280" },
            ].map((s,i,arr)=>(
              <div key={i} style={{display:"contents"}}>
                <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{
                    width:32,height:32,borderRadius:"50%",
                    background:"rgba(255,255,255,0.08)",
                    border:`2px solid ${s.borderColor}`,
                    display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,
                  }}>{s.emoji}</div>
                  <span style={{fontFamily:"'Outfit',sans-serif",fontSize:14,fontWeight:800,color:"white",lineHeight:1}}>{s.count}</span>
                  <span style={{fontSize:9,fontWeight:700,color:s.accent?"#fb923c":"rgba(255,255,255,0.5)",whiteSpace:"nowrap"}}>{s.label}</span>
                </div>
                {i<arr.length-1&&<span style={{color:"rgba(255,255,255,0.2)",fontSize:11,flexShrink:0,marginBottom:14,padding:"0 2px"}}>›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* 매장/날짜 선택 */}
        <div style={{background:"white",padding:"8px 14px",display:"flex",gap:8,borderBottom:"1px solid #eef0f5"}}>
          <select value={selectedStore} onChange={e=>setSelectedStore(e.target.value)}
            style={{flex:1,padding:"8px 10px",borderRadius:8,border:"1px solid #e2e8f0",fontSize:13,fontWeight:600,color:C.textPrimary,background:"#fff",fontFamily:"inherit"}}>
            <option value="">전체 매장</option>
            {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <MeParkDatePicker value={selectedDate} onChange={setSelectedDate} compact style={{flex:1}} />
        </div>

        {/* 필터 칩 */}
        <div style={{background:"white",padding:"9px 14px",display:"flex",gap:6,overflowX:"auto",scrollbarWidth:"none",borderBottom:"1px solid #eef0f5"}}>
          {mobileChips.map(chip=>{
            const isActive = activeMobileFilter === chip.id;
            const isOverdueChip = chip.id === "overdue";
            return (
              <button key={chip.id} onClick={()=>handleMobileChip(chip.id)} style={{
                flexShrink:0,padding:"5px 11px",borderRadius:20,border:"none",cursor:"pointer",
                display:"flex",alignItems:"center",gap:4,
                background: isActive ? (isOverdueChip?"#DC2626":C.navy) : isOverdueChip?"#fff3f3":"#f4f5f8",
                color: isActive ? "white" : isOverdueChip?"#DC2626":"#666",
                fontSize:11,fontWeight:700,
                border: isOverdueChip&&!isActive ? "1px solid #fecaca" : "none",
              }}>
                {chip.label}
                {chip.count > 0 && (
                  <span style={{
                    fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:8,lineHeight:"14px",
                    background: isActive ? "rgba(255,255,255,0.22)" : isOverdueChip?"#DC2626":C.navy,
                    color: "white",
                  }}>{chip.count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* 검색 */}
        <div style={{background:"white",padding:"8px 14px",borderBottom:"6px solid #f4f5f8"}}>
          <div style={{
            background:"#f4f5f8",borderRadius:9,padding:"7px 12px",
            display:"flex",alignItems:"center",gap:7,
            border: search ? `2px solid ${C.navy}` : "2px solid transparent",
            transition:"border-color 0.2s",
          }}>
            <span style={{fontSize:13,color:"#aaa"}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="차량번호 검색 (예: 1234)"
              style={{flex:1,border:"none",outline:"none",background:"none",fontSize:12,color:"#333"}} />
            {search&&<button onClick={()=>setSearch("")} style={{border:"none",background:"#fee2e2",borderRadius:5,width:18,height:18,cursor:"pointer",fontSize:9,color:C.error,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>✕</button>}
          </div>
        </div>

        {/* 카드 리스트 */}
        <div style={{padding:"10px 12px"}}>

          {/* 초과 탭 모바일 뷰 */}
          {activeTab==="overdue"&&(
            <div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:13,fontWeight:800,color:"#DC2626"}}>⚠️ 유예시간 초과</span>
                <button onClick={()=>loadOverdueTickets()} style={{fontSize:11,color:"#DC2626",background:"#fff3f3",border:"1px solid #fecaca",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontWeight:700}}>새로고침</button>
              </div>
              {overdueTickets.length===0?(
                <div style={{textAlign:"center",padding:"50px 0"}}>
                  <div style={{fontSize:36,marginBottom:8}}>✅</div>
                  <div style={{fontSize:14,fontWeight:700,color:"#555"}}>초과 차량 없음</div>
                </div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  {overdueTickets.map(t=>{
                    const overdueMs=t.pre_paid_deadline?Date.now()-new Date(t.pre_paid_deadline).getTime():0;
                    const overdueMin=Math.ceil(overdueMs/60000);
                    return(
                      <div key={t.id} style={{background:"white",borderRadius:16,overflow:"hidden",boxShadow:"0 2px 12px rgba(220,38,38,0.1)",display:"flex",alignItems:"stretch"}}>
                        <div style={{width:5,background:"#DC2626",flexShrink:0,borderRadius:"16px 0 0 16px"}} />
                        <div style={{flex:1,padding:"12px 14px"}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontFamily:"'Outfit',sans-serif",fontSize:17,fontWeight:900,color:"#1A1D2B",letterSpacing:"-0.3px"}}><PlateText plate={t.plate_number} /></span>
                              <button onClick={(ev)=>{ev.stopPropagation();openPlateEdit(t.id,t.plate_number,"mepark_tickets");}}
                                style={{width:22,height:22,borderRadius:"50%",border:"1.5px solid #fecaca",background:"#fff5f5",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                </svg>
                              </button>
                            </span>
                            <span style={{background:"#fee2e2",color:"#DC2626",fontSize:11,fontWeight:800,padding:"3px 9px",borderRadius:6}}>{overdueMin}분 초과</span>
                          </div>
                          <div style={{display:"flex",gap:6,alignItems:"center",marginBottom:8,flexWrap:"wrap"}}>
                            {t.stores?.name&&<span style={{fontSize:11,color:"#94a3b8"}}>🏢 {t.stores.name}</span>}
                            <span style={{color:"#e2e8f0",fontSize:10}}>|</span>
                            <span style={{fontSize:11,color:"#94a3b8"}}>{t.parking_type==="valet"?"발렛":"일반"}</span>
                          </div>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
                            <span style={{fontSize:13,fontWeight:800,color:"#DC2626"}}>추가요금: {(t.additional_fee||0).toLocaleString()}원</span>
                            <a href={`/ticket/${t.id}`} target="_blank" rel="noopener noreferrer"
                              style={{padding:"5px 12px",borderRadius:6,border:"1px solid #1428A0",background:"#eef2ff",color:"#1428A0",fontSize:11,fontWeight:700,textDecoration:"none"}}>
                              🔗 티켓 링크
                            </a>
                          </div>
                          <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
                            <button
                              onClick={()=>handleCompleteOverdue(t.id,false)}
                              disabled={processingId===t.id}
                              style={{padding:"7px 14px",borderRadius:8,border:"none",background:"#1428A0",color:"#fff",fontSize:12,fontWeight:700,cursor:processingId===t.id?"not-allowed":"pointer",opacity:processingId===t.id?0.6:1}}
                            >
                              {processingId===t.id?"처리중...":"💳 결제완료 출차"}
                            </button>
                            <button
                              onClick={()=>handleCompleteOverdue(t.id,true)}
                              disabled={processingId===t.id}
                              style={{padding:"7px 12px",borderRadius:8,border:"1px solid #e2e8f0",background:"#fff",color:"#64748b",fontSize:12,fontWeight:700,cursor:processingId===t.id?"not-allowed":"pointer",opacity:processingId===t.id?0.6:1}}
                            >
                              면제출차
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab!=="overdue"&&(<>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <span style={{fontSize:12,fontWeight:800,color:"#333"}}>{statusFilter==="exited"?"출차 목록":"입차 목록"}</span>
            <span style={{fontSize:10,color:C.navy,fontWeight:700}}>
              총 <strong>{filtered.length}</strong>건 · 최신순
            </span>
          </div>

          {loading?(
            <div style={{textAlign:"center",padding:"40px 0",color:C.textMuted}}>⏳ 로딩 중...</div>
          ):filtered.length===0?(
            <div style={{textAlign:"center",padding:"50px 0"}}>
              <div style={{fontSize:36,marginBottom:8}}>🔍</div>
              <div style={{fontSize:14,fontWeight:700,color:C.textPrimary,marginBottom:4}}>
                {entries.length===0?(statusFilter==="exited"?"출차 데이터가 없습니다":"입차 데이터가 없습니다"):"검색 결과가 없습니다"}
              </div>
              <div style={{fontSize:12,color:C.textMuted}}>
                {entries.length===0?"크루앱에서 입차를 등록하면 표시됩니다":"필터를 변경해 보세요"}
              </div>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              {(showAll ? filtered : filtered.slice(0,80)).map(e=>{
                const ts = typeStyle(e.parking_type);
                const isParked = e.status === "parked";
                const elapsed = isParked ? elapsedStr(e.entry_time) : null;
                const barColor = e.parking_type==="valet" ? C.warning
                  : e.parking_type==="monthly" ? C.success
                  : isParked ? C.navy : "#94a3b8";

                return (
                  <div key={e.id} style={{
                    background:"white",borderRadius:14,overflow:"hidden",
                    boxShadow:"0 1px 8px rgba(20,40,160,0.06)",
                    display:"flex",alignItems:"stretch",
                  }}>
                    <div style={{width:4,background:barColor,flexShrink:0,borderRadius:"14px 0 0 14px"}} />
                    <div style={{flex:1,padding:"8px 12px",display:"flex",alignItems:"center",gap:8}}>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                          <span style={{fontFamily:"'Outfit',sans-serif",fontSize:15,fontWeight:900,color:"#1A1D2B",letterSpacing:"-0.3px"}}>
                            {hlPlate(e.plate_number,search)}
                          </span>
                          {(e as any)._is_zombie&&(
                            <span style={{fontSize:9,fontWeight:800,padding:"1px 6px",borderRadius:4,background:"#fef2f2",color:"#dc2626",flexShrink:0,border:"1px solid #fecaca"}}>
                              ⚠ 이전날짜 미출차
                            </span>
                          )}
                          <span style={{fontSize:10,fontWeight:800,padding:"1px 7px",borderRadius:5,background:ts.bg,color:ts.color,flexShrink:0}}>
                            {ts.label}
                          </span>
                          {isParked&&(
                            <button onClick={(ev)=>{ev.stopPropagation();openPlateEdit(e.id,e.plate_number,e._source||"parking_entries");}}
                              style={{width:22,height:22,borderRadius:"50%",border:`1.5px solid ${C.borderLight}`,background:"#f8fafc",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginLeft:"auto",WebkitTapHighlightColor:"transparent"}}>
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                              </svg>
                            </button>
                          )}
                        </div>
                        <div style={{display:"flex",gap:5,alignItems:"center",flexWrap:"wrap"}}>
                          {e.stores?.name&&<span style={{fontSize:10,color:"#94a3b8",fontWeight:600}}>🏢 {e.stores.name}</span>}
                          {e.floor&&<><span style={{color:"#e2e8f0",fontSize:9}}>|</span><span style={{fontSize:10,color:"#94a3b8"}}>📍 {e.floor}</span></>}
                          <span style={{color:"#e2e8f0",fontSize:9}}>|</span>
                          <span style={{fontSize:10,color:"#94a3b8"}}>⏰ {fmt(e.entry_time)}</span>
                          {!isParked&&e.exit_time&&<><span style={{color:"#e2e8f0",fontSize:9}}>|</span><span style={{fontSize:10,color:"#bbb"}}>→ {fmt(e.exit_time)}</span></>}
                          {e.workers?.name&&<><span style={{color:"#e2e8f0",fontSize:9}}>|</span><span style={{fontSize:10,color:"#bbb"}}>👤 {e.workers.name}</span></>}
                          {e.entry_method&&<><span style={{color:"#e2e8f0",fontSize:9}}>|</span><span style={{fontSize:10,color:e.entry_method==="camera"?"#1D4ED8":"#94a3b8"}}>{e.entry_method==="camera"?"📷":"✏️"}</span></>}
                          {/* 무료 토글 버튼 (mepark_tickets만) */}
                          {e._source==="mepark_tickets"&&(
                            <button
                              onClick={async(ev)=>{
                                ev.stopPropagation();
                                const supabase=createClient();
                                const newVal=!e.is_free;
                                const{error}=await supabase.from("mepark_tickets").update({is_free:newVal}).eq("id",e.id);
                                if(!error) setEntries(prev=>prev.map(x=>x.id===e.id?{...x,is_free:newVal}:x));
                              }}
                              style={{
                                padding:"1px 7px",borderRadius:5,fontSize:10,fontWeight:800,cursor:"pointer",
                                border:"none",WebkitTapHighlightColor:"transparent",
                                background:(e as any).is_free?"#F0FDF4":"#F1F5F9",
                                color:(e as any).is_free?"#16A34A":"#94A3B8",
                              }}>
                              {(e as any).is_free?"🆓 무료":"유료"}
                            </button>
                          )}
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:2,flexShrink:0}}>
                        <span style={{
                          fontSize:9,fontWeight:800,padding:"2px 8px",borderRadius:6,
                          background: isParked ? C.successBg : "#f1f5f9",
                          color: isParked ? C.success : C.textMuted,
                        }}>
                          {isParked ? "주차중" : "출차"}
                        </span>
                        {elapsed&&(
                          <>
                            <span style={{
                              fontFamily:"'Outfit',sans-serif",fontSize:18,fontWeight:900,lineHeight:1,
                              color: e.parking_type==="valet" ? C.warning : C.navy,
                            }}>{elapsed.val}</span>
                            <span style={{fontSize:9,color:"#bbb",fontWeight:700}}>{elapsed.unit}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!showAll && filtered.length>80&&(
                <div onClick={()=>setShowAll(true)} style={{textAlign:"center",padding:"14px 0",fontSize:12,fontWeight:700,color:C.navy,background:"#f8faff",borderRadius:12,cursor:"pointer",border:`1px solid ${C.borderLight}`}}>
                  ▼ 나머지 {filtered.length-80}건 더보기
                </div>
              )}
              {showAll && filtered.length>80&&(
                <div onClick={()=>setShowAll(false)} style={{textAlign:"center",padding:"14px 0",fontSize:12,fontWeight:700,color:C.textMuted,background:"#f8faff",borderRadius:12,cursor:"pointer",border:`1px solid ${C.borderLight}`}}>
                  ▲ 접기
                </div>
              )}
            </div>
          )}
          </>) } {/* end activeTab !== overdue */}
        </div>
      </div>

      {/* 차량번호 수정 모달 */}
      {plateEditTarget && (
        <div onClick={() => setPlateEditTarget(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 20, padding: "28px 24px", width: "min(400px, 90vw)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#1A1D2B", marginBottom: 4 }}>차량번호 수정</div>
            <div style={{ fontSize: 13, color: "#94A3B8", marginBottom: 20 }}>OCR 오인식이나 수기 입력 오류를 수정합니다.</div>

            {/* 기존 번호 */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              padding: 10, background: "#FEF2F2", borderRadius: 10,
              fontSize: 13, color: "#DC2626", fontWeight: 600, marginBottom: 12,
            }}>
              <span>기존:</span>
              <span style={{ letterSpacing: 2, fontWeight: 800, fontSize: 16 }}>{fmtPlate(plateEditTarget.plate)}</span>
            </div>

            {/* 화살표 */}
            <div style={{ textAlign: "center", padding: "6px 0", color: "#94A3B8" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
              </svg>
            </div>

            {/* 새 번호 입력 */}
            <input
              value={editPlateValue}
              onChange={(e) => setEditPlateValue(e.target.value.toUpperCase())}
              placeholder="12가3456"
              maxLength={12}
              autoFocus
              style={{
                width: "100%", height: 56, border: `2px solid ${C.navy}`,
                borderRadius: 14, background: "#EEF2FF",
                fontSize: 24, fontWeight: 800, letterSpacing: 3,
                textAlign: "center", color: "#1A1D2B", outline: "none",
                boxSizing: "border-box", marginTop: 8,
              }}
              onFocus={(e) => { e.target.style.borderColor = "#F5B731"; e.target.style.boxShadow = "0 0 0 3px rgba(245,183,49,0.2)"; }}
              onBlur={(e) => { e.target.style.borderColor = C.navy; e.target.style.boxShadow = "none"; }}
            />
            <div style={{ fontSize: 12, color: "#94A3B8", textAlign: "center", marginTop: 6, marginBottom: 20 }}>
              차량번호를 정확히 입력해주세요
            </div>

            {/* 버튼 */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPlateEditTarget(null)} style={{
                flex: 1, height: 48, borderRadius: 12, border: `1px solid ${C.borderLight}`,
                background: "#f8fafc", color: "#475569", fontSize: 15, fontWeight: 600, cursor: "pointer",
              }}>취소</button>
              <button
                onClick={handlePlateEdit}
                disabled={plateEditLoading || !editPlateValue.trim() || editPlateValue.trim().length < 4 || editPlateValue.trim().toUpperCase() === plateEditTarget.plate}
                style={{
                  flex: 1, height: 48, borderRadius: 12, border: "none",
                  background: C.navy, color: "#fff", fontSize: 15, fontWeight: 700, cursor: "pointer",
                  opacity: (!editPlateValue.trim() || editPlateValue.trim().length < 4 || editPlateValue.trim().toUpperCase() === plateEditTarget.plate) ? 0.4 : 1,
                  transition: "opacity 0.2s",
                }}
              >
                {plateEditLoading ? "처리 중..." : "✏️ 수정"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
