
(() => {
  "use strict";

  const MONTHS = [
    ["2026-09","Septembre 2026"],["2026-10","Octobre 2026"],["2026-11","Novembre 2026"],
    ["2026-12","Décembre 2026"],["2027-01","Janvier 2027"],["2027-02","Février 2027"],
    ["2027-03","Mars 2027"],["2027-04","Avril 2027"],["2027-05","Mai 2027"],
    ["2027-06","Juin 2027"],["2027-07","Juillet 2027"],["2027-08","Août 2027"]
  ];

  const ENVELOPES = [
    {name:"Alimentation",icon:"🍎",before:900,after:900},
    {name:"Essence",icon:"⛽",before:200,after:200},
    {name:"Restaurant",icon:"🍽️",before:120,after:120},
    {name:"Argent de poche",icon:"💶",before:60,after:60},
    {name:"Abonnements",icon:"📺",before:95,after:66},
    {name:"Vêtements / chaussures",icon:"👕",before:180,after:180},
    {name:"Bricolage / rénovation",icon:"🔨",before:250,after:250},
    {name:"Sports / activités",icon:"🏒",before:600,after:600},
    {name:"Cadeaux",icon:"🎁",before:250,after:250},
    {name:"Vacances",icon:"✈️",before:45,after:74},
    {name:"Coiffeur",icon:"✂️",before:50,after:50},
    {name:"Repas extérieurs Guillaume",icon:"🥪",before:150,after:150},
    {name:"Épargne",icon:"💰",before:300,after:300}
  ];

  const PEOPLE = ["Famille","Laura","Guillaume","Manon","Sacha","Gabin","Maison","Vacances 1","Vacances 2"];
  const $ = id => document.getElementById(id);
  const euro = value => new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2}).format(Number(value)||0);

  let supabaseClient;
  let session = null;
  let selectedMonth = localStorage.getItem("bf_v3_month") || "2026-09";
  let expenses = [];
  let budgets = [];
  let incomes = [];
  let editingEnvelope = null;
  let realtimeChannel = null;
  let toastTimer = null;
  let realtimeRefreshTimer = null;

  function defaultBudget(envelope, month) {
    return month === "2026-09" || month === "2026-10" ? envelope.before : envelope.after;
  }

  function budgetFor(name, month = selectedMonth) {
    const stored = budgets.find(row => row.mois === month && row.enveloppe === name);
    if (stored) return Number(stored.montant);
    return defaultBudget(ENVELOPES.find(item => item.name === name), month);
  }

  function incomeFor(month = selectedMonth) {
    const row = incomes.find(item => item.mois === month);
    return row ? Number(row.montant) : 3200;
  }

  function expensesForMonth(month = selectedMonth) {
    return expenses.filter(row => String(row.date_depense).slice(0,7) === month);
  }

  function spentFor(name, month = selectedMonth) {
    return expensesForMonth(month)
      .filter(row => row.enveloppe === name)
      .reduce((sum,row) => sum + Number(row.montant), 0);
  }

  async function init() {
    if (!window.supabase || !window.BUDGET_CONFIG) {
      $("boot").innerHTML = "<strong>Chargement impossible</strong><span>Vérifiez la connexion internet.</span>";
      return;
    }

    supabaseClient = window.supabase.createClient(
      window.BUDGET_CONFIG.supabaseUrl,
      window.BUDGET_CONFIG.supabasePublishableKey
    );

    populateControls();
    bindEvents();

    const { data } = await supabaseClient.auth.getSession();
    session = data?.session || null;

    supabaseClient.auth.onAuthStateChange((_event,newSession) => {
      session = newSession;
      if (session) startApplication().catch(handleError);
      else {
        stopRealtime();
        showLogin();
      }
    });

    if (session) await startApplication();
    else showLogin();
  }

  function populateControls() {
    $("monthSelect").innerHTML = MONTHS.map(([key,label]) => `<option value="${key}">${label}</option>`).join("");
    $("monthSelect").value = selectedMonth;
    $("expenseEnvelope").innerHTML = ENVELOPES.map(item => `<option value="${escapeHtml(item.name)}">${item.icon} ${escapeHtml(item.name)}</option>`).join("");
    $("expensePerson").innerHTML = PEOPLE.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("");
    $("expenseDate").value = new Date().toISOString().slice(0,10);
  }

  function showLogin() {
    $("boot").classList.add("hidden");
    $("application").classList.add("hidden");
    $("login").classList.remove("hidden");
  }

  async function login() {
    $("loginError").textContent = "";
    const email = $("email").value.trim();
    const password = $("password").value;
    if (!email || !password) {
      $("loginError").textContent = "Renseignez l’adresse e-mail et le mot de passe.";
      return;
    }

    $("loginButton").disabled = true;
    $("loginButton").textContent = "Connexion…";
    const { error } = await supabaseClient.auth.signInWithPassword({email,password});
    $("loginButton").disabled = false;
    $("loginButton").textContent = "Se connecter";

    if (error) $("loginError").textContent = "Identifiants incorrects ou utilisateur non confirmé.";
  }

  async function startApplication() {
    $("boot").classList.add("hidden");
    $("login").classList.add("hidden");
    $("application").classList.remove("hidden");
    $("connectedEmail").textContent = session.user.email || "";
    await ensureDefaults();
    await loadData();
    startRealtime();
  }

  async function ensureDefaults() {
    const userId = session.user.id;

    const { data: budgetCheck, error: budgetError } = await supabaseClient
      .from("budgets").select("id").limit(1);
    if (budgetError) throw budgetError;

    if (!budgetCheck.length) {
      const rows = [];
      for (const [month] of MONTHS) {
        for (const envelope of ENVELOPES) {
          rows.push({
            user_id:userId, mois:month, enveloppe:envelope.name,
            montant:defaultBudget(envelope,month)
          });
        }
      }
      const { error } = await supabaseClient.from("budgets").insert(rows);
      if (error) throw error;
    }

    const { data: incomeCheck, error: incomeError } = await supabaseClient
      .from("revenus").select("id").limit(1);
    if (incomeError) throw incomeError;

    if (!incomeCheck.length) {
      const rows = MONTHS.map(([month]) => ({user_id:userId,mois:month,montant:3200}));
      const { error } = await supabaseClient.from("revenus").insert(rows);
      if (error) throw error;
    }
  }

  async function loadData() {
    const [expenseRes,budgetRes,incomeRes] = await Promise.all([
      supabaseClient.from("depenses").select("*").order("date_depense",{ascending:false}).order("created_at",{ascending:false}),
      supabaseClient.from("budgets").select("*"),
      supabaseClient.from("revenus").select("*")
    ]);
    if (expenseRes.error) throw expenseRes.error;
    if (budgetRes.error) throw budgetRes.error;
    if (incomeRes.error) throw incomeRes.error;
    expenses = expenseRes.data || [];
    budgets = budgetRes.data || [];
    incomes = incomeRes.data || [];
    renderAll();
  }

  function renderAll() {
    $("monthSelect").value = selectedMonth;
    $("envelopePageMonth").textContent = monthLabel();
    const current = expensesForMonth();
    const spent = current.reduce((sum,row) => sum + Number(row.montant),0);
    const income = incomeFor();
    $("incomeTotal").textContent = euro(income);
    $("spentTotal").textContent = euro(spent);
    $("remainingTotal").textContent = euro(income-spent);
    $("remainingTotal").classList.toggle("negative",income-spent<0);
    renderEnvelopeCards();
    renderEnvelopeList();
    renderPreview();
    renderHistory();
  }

  function renderEnvelopeCards() {
    $("envelopeGrid").innerHTML = ENVELOPES.map(envelope => cardMarkup(envelope)).join("");
    bindEnvelopeButtons();
  }

  function renderEnvelopeList() {
    $("envelopeList").innerHTML = ENVELOPES.map(envelope => {
      const budget = budgetFor(envelope.name);
      const spent = spentFor(envelope.name);
      return `<div class="stack-row">
        <button data-envelope="${escapeHtml(envelope.name)}">
          <strong>${envelope.icon} ${escapeHtml(envelope.name)}</strong>
          <span class="row-meta">${euro(spent)} dépensés sur ${euro(budget)}</span>
        </button>
        <div class="row-side">
          <div class="row-amount ${budget-spent<0?"negative":""}">${euro(budget-spent)}</div>
          <div class="row-meta">restants</div>
        </div>
      </div>`;
    }).join("");
    bindEnvelopeButtons();
  }

  function cardMarkup(envelope) {
    const budget = budgetFor(envelope.name);
    const spent = spentFor(envelope.name);
    const remaining = budget-spent;
    const pct = budget ? Math.min(100,spent/budget*100) : 0;
    const cls = spent>budget ? "over" : spent>budget*.85 ? "warn" : "";
    return `<button class="envelope-card" data-envelope="${escapeHtml(envelope.name)}">
      <div class="envelope-head">
        <div><div class="envelope-icon">${envelope.icon}</div><h3>${escapeHtml(envelope.name)}</h3></div>
        <div class="budget-value">${euro(budget)}</div>
      </div>
      <div class="progress"><div class="bar ${cls}" style="width:${pct}%"></div></div>
      <small>${euro(spent)} dépensés</small>
      <div class="envelope-remaining ${remaining<0?"negative":""}">${euro(remaining)} restants</div>
    </button>`;
  }

  function bindEnvelopeButtons() {
    document.querySelectorAll("[data-envelope]").forEach(button => {
      button.addEventListener("click",() => openEnvelope(button.dataset.envelope));
    });
  }

  function openEnvelope(name) {
    const envelope = ENVELOPES.find(item => item.name===name);
    editingEnvelope = name;
    const budget = budgetFor(name);
    const spent = spentFor(name);
    $("modalEnvelopeIcon").textContent = envelope.icon;
    $("modalEnvelopeName").textContent = name;
    $("modalEnvelopeMonth").textContent = monthLabel();
    $("modalBudgetValue").textContent = euro(budget);
    $("modalSpentValue").textContent = euro(spent);
    $("modalRemainingValue").textContent = euro(budget-spent);
    $("modalRemainingValue").classList.toggle("negative",budget-spent<0);
    $("modalBudgetInput").value = budget;
    openModal("envelopeModal");
  }

  function renderPreview() {
    const name = $("expenseEnvelope").value || ENVELOPES[0].name;
    const typed = Number($("expenseAmount").value)||0;
    const budget = budgetFor(name);
    const projected = spentFor(name)+typed;
    const remaining = budget-projected;
    $("previewEnvelope").textContent = name;
    $("previewRemaining").textContent = euro(remaining);
    $("previewRemaining").classList.toggle("negative",remaining<0);
    $("previewUsed").textContent = `${euro(projected)} après dépense`;
    $("previewBudget").textContent = `Budget ${euro(budget)}`;
    const pct = budget ? Math.min(100,projected/budget*100) : 0;
    $("previewBar").style.width = `${pct}%`;
    $("previewBar").className = `bar ${projected>budget?"over":projected>budget*.85?"warn":""}`;
  }

  function renderHistory() {
    const query = $("historySearch").value.trim().toLowerCase();
    let rows = [...expenses];
    if (query) rows = rows.filter(row =>
      [row.libelle,row.enveloppe,row.personne,row.ajoute_par].filter(Boolean).join(" ").toLowerCase().includes(query)
    );
    $("historyCount").textContent = `${rows.length} dépense${rows.length>1?"s":""}`;
    if (!rows.length) {
      $("historyList").innerHTML = `<div class="empty">Aucune dépense enregistrée.</div>`;
      return;
    }
    $("historyList").innerHTML = rows.map(row => `<div class="history-row">
      <div>
        <strong>${escapeHtml(row.libelle || row.enveloppe)}</strong>
        <div class="row-meta">${formatDate(row.date_depense)} · ${escapeHtml(row.enveloppe)} · ${escapeHtml(row.personne || "Famille")}${row.ajoute_par?` · par ${escapeHtml(row.ajoute_par)}`:""}</div>
      </div>
      <div class="row-side">
        <div class="row-amount">${euro(row.montant)}</div>
        <button class="delete" data-delete="${row.id}">Supprimer</button>
      </div>
    </div>`).join("");
    document.querySelectorAll("[data-delete]").forEach(button => {
      button.addEventListener("click",() => deleteExpense(button.dataset.delete));
    });
  }

  async function saveExpense() {
    $("expenseError").textContent = "";
    const date = $("expenseDate").value;
    const amount = Number($("expenseAmount").value);
    if (!date || !Number.isFinite(amount) || amount<=0) {
      $("expenseError").textContent = "Indiquez une date et un montant supérieur à zéro.";
      return;
    }
    const payload = {
      user_id:session.user.id,
      date_depense:date,
      montant:amount,
      enveloppe:$("expenseEnvelope").value,
      personne:$("expensePerson").value,
      libelle:$("expenseLabel").value.trim() || null,
      ajoute_par:$("expenseAuthor").value
    };
    const { error } = await supabaseClient.from("depenses").insert(payload);
    if (error) {
      $("expenseError").textContent = "Enregistrement impossible.";
      console.error(error);
      return;
    }
    $("expenseAmount").value = "";
    $("expenseLabel").value = "";
    selectedMonth = date.slice(0,7);
    localStorage.setItem("bf_v3_month",selectedMonth);
    await loadData();
    switchPage("homePage","Accueil");
    toast("Dépense enregistrée et synchronisée.");
  }

  async function deleteExpense(id) {
    if (!confirm("Supprimer cette dépense sur tous les appareils ?")) return;
    const { error } = await supabaseClient.from("depenses").delete().eq("id",id);
    if (error) return toast("Suppression impossible.");
    await loadData();
    toast("Dépense supprimée.");
  }

  async function saveBudget() {
    const value = Number($("modalBudgetInput").value);
    if (!editingEnvelope || !Number.isFinite(value) || value<0) return;
    const { error } = await supabaseClient.from("budgets").upsert({
      user_id:session.user.id,mois:selectedMonth,enveloppe:editingEnvelope,
      montant:value,updated_at:new Date().toISOString()
    },{onConflict:"user_id,mois,enveloppe"});
    if (error) {
      console.error(error);
      return toast("Modification impossible.");
    }
    closeModal();
    await loadData();
    toast("Budget mis à jour.");
  }

  async function saveIncome() {
    const value = Number($("incomeInput").value);
    if (!Number.isFinite(value) || value<0) return;
    const { error } = await supabaseClient.from("revenus").upsert({
      user_id:session.user.id,mois:selectedMonth,montant:value,updated_at:new Date().toISOString()
    },{onConflict:"user_id,mois"});
    if (error) {
      console.error(error);
      return toast("Modification impossible.");
    }
    closeModal();
    await loadData();
    toast("Revenu mis à jour.");
  }

  function startRealtime() {
    stopRealtime();
    realtimeChannel = supabaseClient.channel(`budget-v3-${session.user.id}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"depenses"},scheduleRealtimeRefresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"budgets"},scheduleRealtimeRefresh)
      .on("postgres_changes",{event:"*",schema:"public",table:"revenus"},scheduleRealtimeRefresh)
      .subscribe();
  }

  function scheduleRealtimeRefresh() {
    clearTimeout(realtimeRefreshTimer);
    realtimeRefreshTimer = setTimeout(() => loadData().catch(handleError),250);
  }

  function stopRealtime() {
    if (realtimeChannel && supabaseClient) supabaseClient.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  function switchPage(pageId,title) {
    document.querySelectorAll(".page").forEach(page => page.classList.toggle("active",page.id===pageId));
    document.querySelectorAll(".nav-button").forEach(button => button.classList.toggle("active",button.dataset.page===pageId));
    $("pageTitle").textContent = title;
    if (pageId==="expensePage") renderPreview();
  }

  function openModal(id) {
    $("modalLayer").classList.remove("hidden");
    $("envelopeModal").classList.toggle("hidden",id!=="envelopeModal");
    $("incomeModal").classList.toggle("hidden",id!=="incomeModal");
  }

  function closeModal() {
    $("modalLayer").classList.add("hidden");
    $("envelopeModal").classList.add("hidden");
    $("incomeModal").classList.add("hidden");
    editingEnvelope = null;
  }

  function toast(message) {
    clearTimeout(toastTimer);
    $("toast").textContent = message;
    $("toast").classList.remove("hidden");
    toastTimer = setTimeout(() => $("toast").classList.add("hidden"),2500);
  }

  function exportCsv() {
    const rows = [["Date","Montant","Enveloppe","Personne / projet","Libellé","Ajouté par"],
      ...expenses.map(row => [row.date_depense,Number(row.montant).toFixed(2).replace(".",","),row.enveloppe,row.personne||"",row.libelle||"",row.ajoute_par||""])];
    const csv = rows.map(row => row.map(value => `"${String(value).replaceAll('"','""')}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href=url;a.download="Budget_Familial_V3.0.0.csv";
    document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(url);a.remove()},1000);
  }

  function monthLabel() {
    return MONTHS.find(([key])=>key===selectedMonth)?.[1] || selectedMonth;
  }

  function formatDate(value) {
    return new Date(`${value}T12:00:00`).toLocaleDateString("fr-FR");
  }

  function escapeHtml(value) {
    return String(value??"").replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[ch]));
  }

  function bindEvents() {
    $("loginButton").addEventListener("click",login);
    $("password").addEventListener("keydown",event=>{if(event.key==="Enter")login()});
    $("refreshButton").addEventListener("click",()=>loadData().then(()=>toast("Données actualisées.")).catch(handleError));
    $("forceRefreshButton").addEventListener("click",()=>loadData().then(()=>toast("Données actualisées.")).catch(handleError));
    $("monthSelect").addEventListener("change",event=>{
      selectedMonth=event.target.value;
      localStorage.setItem("bf_v3_month",selectedMonth);
      renderAll();
    });
    $("editIncomeButton").addEventListener("click",()=>{
      $("incomeModalMonth").textContent=monthLabel();
      $("incomeInput").value=incomeFor();
      openModal("incomeModal");
    });
    $("saveIncomeButton").addEventListener("click",saveIncome);
    $("saveBudgetButton").addEventListener("click",saveBudget);
    $("saveExpenseButton").addEventListener("click",saveExpense);
    $("expenseEnvelope").addEventListener("change",renderPreview);
    $("expenseAmount").addEventListener("input",renderPreview);
    $("historySearch").addEventListener("input",renderHistory);
    $("expenseDate").addEventListener("change",event=>{
      const month=event.target.value.slice(0,7);
      if(MONTHS.some(([key])=>key===month)){
        selectedMonth=month;
        localStorage.setItem("bf_v3_month",selectedMonth);
        renderAll();
      }
    });
    document.querySelectorAll("[data-add]").forEach(button=>button.addEventListener("click",()=>{
      $("expenseAmount").value=(Number($("expenseAmount").value)||0)+Number(button.dataset.add);
      renderPreview();
    }));
    document.querySelectorAll(".nav-button").forEach(button=>button.addEventListener("click",()=>switchPage(button.dataset.page,button.dataset.title)));
    document.querySelectorAll("[data-close-modal]").forEach(button=>button.addEventListener("click",closeModal));
    $("modalLayer").addEventListener("click",event=>{if(event.target.id==="modalLayer")closeModal()});
    $("logoutButton").addEventListener("click",()=>supabaseClient.auth.signOut());
    $("exportButton").addEventListener("click",exportCsv);
  }

  function handleError(error) {
    console.error(error);
    toast("Une erreur est survenue.");
  }

  init().catch(handleError);
})();
