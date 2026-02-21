// @ts-nocheck
"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { getUserContext } from "@/lib/utils/org";
import AppLayout from "@/components/layout/AppLayout";

const C = {
  navy: "#1428A0", navyLight: "#2d3a8c", gold: "#F5B731", goldLight: "#fef9e7",
  success: "#10b981", successBg: "#ecfdf5", warning: "#f59e0b", warningBg: "#fffbeb",
  error: "#ef4444", errorBg: "#fef2f2", purple: "#8b5cf6", purpleBg: "#f5f3ff",
  bgPage: "#f8f9fb", bgCard: "#f4f5f7", border: "#e2e4e9", borderLight: "#eef0f3",
  textPrimary: "#1a1d26", textSecondary: "#5c6370", textMuted: "#8b919d",
};

const typeStyle = (t) => ({
  normal:  { bg: `${C.navy}12`, color: C.navy,    label: "일반" },
  valet:   { bg: `${C.gold}30`, color: "#92710b", label: "발렛" },
  monthly: { bg: C.purpleBg,    color: C.purple,  label: "월주차" },
}[t] || { bg: C.bgCard, color: C.textSecondary, label: t });

const fmt = (ts) => {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
};

const hlPlate = (plate, query) => {
  if (!query) return plate;
  const q = query.replace(/\s/g,"").toLowerCase();
  const p = (plate||"").replace(/\s/g,"").toLowerCase();
  const idx = p.indexOf(q);
  if (idx===-1) return plate;
  let s=-1,end=-1,cnt=0;
  for(let i=0;i<plate.length;i++){
    if(plate[i]!==" "){
      if(cnt===idx) s=i;
      if(cnt===idx+q.length-1){end=i+1;break;}
      cnt++;
    }
  }
  if(s===-1) return plate;
  return <span>{plate.slice(0,s)}<span style={{background:"#FEF08A",borderRadius:3,padding:"0 2px"}}>{plate.slice(s,end)}</span>{plate.slice(end)}</span>;
};

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
  const [loading,setLoading]=useState(true);
  const [selectedStore,setSelectedStore]=useState("");
  const [selectedDate,setSelectedDate]=useState(new Date().toISOString().split("T")[0]);
  const [search,setSearch]=useState("");
  const [typeFilter,setTypeFilter]=useState("all");
  const [statusFilter,setStatusFilter]=useState("all");
  const [workerFilter,setWorkerFilter]=useState("");

  useEffect(()=>{loadInitial();},[]);
  useEffect(()=>{loadEntries();},[selectedStore,selectedDate]);

  const loadInitial=async()=>{
    const supabase=createClient();
    const ctx=await getUserContext();
    if(!ctx.orgId) return;
    let q=supabase.from("stores").select("id,name").eq("org_id",ctx.orgId).eq("is_active",true).order("name");
    if(!ctx.allStores&&ctx.storeIds.length>0) q=q.in("id",ctx.storeIds);
    else if(!ctx.allStores){setStores([]);return;}
    const [{data:sd},{data:wd}]=await Promise.all([q,supabase.from("workers").select("id,name").eq("org_id",ctx.orgId).order("name")]);
    setStores(sd||[]);setWorkers(wd||[]);loadEntries();
  };

  const loadEntries=async()=>{
    setLoading(true);
    const supabase=createClient();
    let q=supabase.from("parking_entries").select("*,stores(name),workers(name)")
      .gte("entry_time",`${selectedDate}T00:00:00`).lte("entry_time",`${selectedDate}T23:59:59`)
      .order("entry_time",{ascending:false});
    if(selectedStore) q=q.eq("store_id",selectedStore);
    const{data}=await q;
    setEntries(data||[]);setLoading(false);
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

  return (
    <AppLayout>
      <style>{`
        @media (max-width: 767px) {
          .ps-filter-bar { padding: 12px 14px !important; gap: 8px !important; }
          .ps-filter-row1 { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: 8px; }
          .ps-search-wrap { max-width: 100% !important; min-width: unset !important; flex: unset !important; width: 100% !important; }
          .ps-result-label { display: none !important; }
          .ps-kpi-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; margin-bottom: 16px !important; }
          .ps-kpi-card { padding: 14px 14px !important; border-radius: 12px !important; }
          .ps-kpi-icon { width: 36px !important; height: 36px !important; font-size: 18px !important; border-radius: 10px !important; margin-bottom: 10px !important; }
          .ps-kpi-value { font-size: 22px !important; }
          .ps-filter-chart-grid { grid-template-columns: 1fr !important; gap: 12px !important; margin-bottom: 16px !important; }
          .ps-filter-groups { flex-direction: row !important; flex-wrap: wrap !important; gap: 8px !important; }
          .ps-chart-card { padding: 12px 14px !important; }
          .ps-chart-bars { height: 60px !important; }
          .ps-main { padding-bottom: 100px !important; }
        }
      `}</style>
      <div style={{maxWidth:1300}} className="ps-main">

        {/* 필터 바 */}
        <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.borderLight}`,boxShadow:"0 1px 2px rgba(0,0,0,0.04)",marginBottom:20}}>
          <div className="ps-filter-bar" style={{padding:"16px 24px",display:"flex",flexDirection:"column",gap:12}}>
            {/* 1행: 매장/날짜 */}
            <div className="ps-filter-row1" style={{display:"flex",gap:12,flexWrap:"wrap",alignItems:"center"}}>
              <select value={selectedStore} onChange={e=>setSelectedStore(e.target.value)}
                style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,fontWeight:600,background:"#fff",minWidth:140,flex:1}}>
                <option value="">전체 매장</option>
                {stores.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input type="date" value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}
                style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,background:"#fff",flex:1}} />
              <select value={workerFilter} onChange={e=>setWorkerFilter(e.target.value)}
                className="hidden md:block"
                style={{padding:"10px 14px",borderRadius:10,border:`1px solid ${C.border}`,fontSize:14,background:"#fff",minWidth:120}}>
                <option value="">전체 등록자</option>
                {entryWorkers.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            {/* 2행: 검색 + 결과 */}
            <div style={{display:"flex",gap:12,alignItems:"center"}}>
              <div className="ps-search-wrap" style={{display:"flex",alignItems:"center",gap:8,background:"#fff",borderRadius:10,
                border:search?`2px solid ${C.navy}`:`1px solid ${C.border}`,padding:"0 14px",
                minWidth:200,flex:1,maxWidth:360,transition:"border-color 0.2s"}}>
                <span style={{fontSize:15,color:C.textMuted}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="차량번호 검색"
                  style={{flex:1,border:"none",outline:"none",background:"none",fontSize:14,fontWeight:600,padding:"10px 0",color:C.textPrimary}} />
                {search&&<button onClick={()=>setSearch("")} style={{border:"none",background:C.errorBg,borderRadius:6,width:22,height:22,cursor:"pointer",fontSize:10,color:C.error,fontWeight:700}}>✕</button>}
              </div>
              <div className="ps-result-label" style={{marginLeft:"auto",fontSize:13,color:C.textMuted,background:C.bgCard,padding:"8px 14px",borderRadius:8,whiteSpace:"nowrap"}}>
                검색 결과 <strong style={{color:C.navy,marginLeft:4}}>{filtered.length}건</strong>
              </div>
            </div>
          </div>
        </div>

        {/* KPI 카드 */}
        <div className="ps-kpi-grid" style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:16,marginBottom:24}}>
          {kpiCards.map(k=>(
            <div key={k.label} className="ps-kpi-card" style={{background:"#fff",borderRadius:16,padding:"20px 22px",border:`1px solid ${C.borderLight}`,boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
              <div className="ps-kpi-icon" style={{width:44,height:44,borderRadius:12,background:k.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,marginBottom:14}}>{k.icon}</div>
              <div className="ps-kpi-value" style={{fontSize:28,fontWeight:800,color:k.color,lineHeight:1}}>
                {k.value.toLocaleString()}<span style={{fontSize:14,fontWeight:600,color:C.textMuted,marginLeft:4}}>{k.unit}</span>
              </div>
              <div style={{fontSize:13,color:C.textMuted,marginTop:6}}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* 필터 그룹 + 시간대 차트 */}
        <div className="ps-filter-chart-grid" style={{display:"grid",gridTemplateColumns:"auto 1fr",gap:20,marginBottom:24,alignItems:"start"}}>
          <div className="ps-filter-groups" style={{display:"flex",flexDirection:"column",gap:10}}>
            <FilterGroup value={typeFilter} onChange={setTypeFilter}
              options={[{id:"all",label:"전체"},{id:"normal",label:"일반"},{id:"valet",label:"발렛"},{id:"monthly",label:"월주차"}]} />
            <FilterGroup value={statusFilter} onChange={setStatusFilter}
              options={[{id:"all",label:"전체"},{id:"parked",label:"🟢 주차중"},{id:"exited",label:"⚪ 출차"}]} />
          </div>
          <div className="ps-chart-card" style={{background:"#fff",borderRadius:16,padding:"16px 20px",border:`1px solid ${C.borderLight}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
              <div style={{fontSize:14,fontWeight:700,color:C.textPrimary}}>⏰ 시간대별 입차</div>
              <div style={{fontSize:12,color:C.textMuted,background:C.bgCard,padding:"4px 10px",borderRadius:6}}>
                <strong style={{color:C.navy}}>{filtered.length}</strong>건
              </div>
            </div>
            <div className="ps-chart-bars" style={{display:"flex",alignItems:"flex-end",gap:3,height:80}}>
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

        {/* 테이블 (PC) */}
        <div className="hidden md:block">
          <div style={{background:"#fff",borderRadius:16,border:`1px solid ${C.borderLight}`,overflow:"hidden",boxShadow:"0 1px 2px rgba(0,0,0,0.04)"}}>
            {loading?(
              <div style={{textAlign:"center",padding:"60px 0",color:C.textMuted,fontSize:15}}>⏳ 로딩 중...</div>
            ):filtered.length===0?(
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{fontSize:44,marginBottom:12}}>🔍</div>
                <div style={{fontSize:16,fontWeight:700,color:C.textPrimary,marginBottom:6}}>
                  {entries.length===0?"입차 데이터가 없습니다":"검색 결과가 없습니다"}
                </div>
                <div style={{fontSize:13,color:C.textMuted}}>
                  {entries.length===0?"크루앱에서 입차를 등록하면 여기에 표시됩니다":"필터를 변경해 보세요"}
                </div>
              </div>
            ):(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr>
                    {["차량번호","매장","유형","입차시간","출차시간","위치","등록자","상태"].map(h=>(
                      <th key={h} style={{padding:"14px 16px",textAlign:"left",fontSize:13,fontWeight:600,color:C.textMuted,background:C.bgCard,borderBottom:`1px solid ${C.borderLight}`}}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0,50).map((e,i)=>{
                    const ts=typeStyle(e.parking_type);
                    const isParked=e.status==="parked";
                    return(
                      <tr key={e.id} style={{background:i%2===0?"#fff":C.bgPage}}>
                        <td style={{padding:"12px 16px",fontSize:15,fontWeight:800,color:C.textPrimary,letterSpacing:0.3,borderBottom:`1px solid ${C.borderLight}`}}>{hlPlate(e.plate_number,search)}</td>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:C.textSecondary,borderBottom:`1px solid ${C.borderLight}`,maxWidth:140,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.stores?.name||"-"}</td>
                        <td style={{padding:"12px 16px",borderBottom:`1px solid ${C.borderLight}`}}>
                          <span style={{padding:"4px 12px",borderRadius:6,fontSize:12,fontWeight:700,background:ts.bg,color:ts.color}}>{ts.label}</span>
                        </td>
                        <td style={{padding:"12px 16px",fontSize:14,fontWeight:700,color:C.textPrimary,borderBottom:`1px solid ${C.borderLight}`}}>{fmt(e.entry_time)}</td>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:600,color:e.exit_time?C.textSecondary:C.textMuted,borderBottom:`1px solid ${C.borderLight}`}}>{fmt(e.exit_time)}</td>
                        <td style={{padding:"12px 16px",fontSize:12,color:C.textMuted,borderBottom:`1px solid ${C.borderLight}`}}>{e.floor||"-"}</td>
                        <td style={{padding:"12px 16px",fontSize:13,fontWeight:500,color:C.textSecondary,borderBottom:`1px solid ${C.borderLight}`}}>{e.workers?.name||"-"}</td>
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
            {filtered.length>50&&(
              <div style={{textAlign:"center",padding:"14px 0",borderTop:`1px solid ${C.borderLight}`,fontSize:13,fontWeight:700,color:C.navy}}>
                + {filtered.length-50}건 더보기
              </div>
            )}
          </div>
        </div>

        {/* 카드형 (모바일) */}
        <div className="md:hidden" style={{display:"flex",flexDirection:"column",gap:10,paddingBottom:100}}>
          {loading?(
            <div style={{textAlign:"center",padding:"60px 0",color:C.textMuted}}>⏳ 로딩 중...</div>
          ):filtered.length===0?(
            <div style={{textAlign:"center",padding:"60px 0"}}>
              <div style={{fontSize:40,marginBottom:8}}>🔍</div>
              <div style={{fontSize:14,fontWeight:700,color:C.textPrimary,marginBottom:4}}>{entries.length===0?"입차 데이터가 없습니다":"검색 결과가 없습니다"}</div>
              <div style={{fontSize:12,color:C.textMuted}}>{entries.length===0?"크루앱에서 입차를 등록하면 표시됩니다":"필터를 변경해 보세요"}</div>
            </div>
          ):(
            <>
              <div style={{fontSize:12,color:C.textMuted,padding:"0 2px",marginBottom:2}}>
                총 <strong style={{color:C.navy}}>{filtered.length}건</strong>
              </div>
              {filtered.slice(0,50).map(e=>{
                const ts=typeStyle(e.parking_type);
                const isParked=e.status==="parked";
                return(
                  <div key={e.id} style={{
                    background:"#fff",borderRadius:14,padding:"14px 16px",
                    border:`1px solid ${isParked?`${C.success}30`:C.borderLight}`,
                    boxShadow:"0 1px 3px rgba(0,0,0,0.05)",
                    borderLeft:`4px solid ${isParked?C.success:C.bgCard}`
                  }}>
                    {/* 상단: 번호판 + 상태뱃지 */}
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                      <span style={{fontSize:18,fontWeight:800,color:C.textPrimary,letterSpacing:0.3}}>{hlPlate(e.plate_number,search)}</span>
                      <div style={{display:"flex",gap:6,alignItems:"center"}}>
                        <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700,background:ts.bg,color:ts.color}}>{ts.label}</span>
                        <span style={{padding:"4px 10px",borderRadius:6,fontSize:11,fontWeight:700,background:isParked?C.successBg:C.bgCard,color:isParked?C.success:C.textMuted}}>
                          {isParked?"🟢 주차중":"⚪ 출차"}
                        </span>
                      </div>
                    </div>
                    {/* 하단: 메타 정보 2열 그리드 */}
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px 12px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:11,color:C.textMuted}}>🏢</span>
                        <span style={{fontSize:12,fontWeight:600,color:C.textSecondary}}>{e.stores?.name||"-"}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:11,color:C.textMuted}}>👤</span>
                        <span style={{fontSize:12,fontWeight:600,color:C.textSecondary}}>{e.workers?.name||"-"}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:11,color:C.textMuted}}>⏰ 입차</span>
                        <span style={{fontSize:12,fontWeight:700,color:C.textPrimary}}>{fmt(e.entry_time)}</span>
                      </div>
                      {e.exit_time&&(
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:11,color:C.textMuted}}>🚪 출차</span>
                          <span style={{fontSize:12,fontWeight:700,color:C.textSecondary}}>{fmt(e.exit_time)}</span>
                        </div>
                      )}
                      {e.floor&&(
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <span style={{fontSize:11,color:C.textMuted}}>📍</span>
                          <span style={{fontSize:12,color:C.textSecondary}}>{e.floor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length>50&&(
                <div style={{textAlign:"center",padding:"14px 0",fontSize:13,fontWeight:700,color:C.navy}}>
                  + {filtered.length-50}건 더 있음
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

