"""
CITYFLOW AI — Municipal Pothole Intelligence Dashboard
Student capstone prototype for demonstrating automatic pothole/road-impact
reports to a municipal road-maintenance team.

Run:
    python3 -m streamlit run Municipal-complaint-dashboard.py
"""

import streamlit as st
import pandas as pd
import folium
from streamlit_folium import st_folium

# -----------------------------------------------------------------------------
# PAGE CONFIG
# -----------------------------------------------------------------------------
st.set_page_config(
    page_title="CityFlow AI — Municipal Pothole Dashboard",
    page_icon="🛣️",
    layout="wide",
    initial_sidebar_state="expanded",
)

# -----------------------------------------------------------------------------
# THEME
# -----------------------------------------------------------------------------
NAVY = "#0B3D66"
NAVY_DARK = "#082A47"
SAFFRON = "#FF9933"
GREEN = "#128807"
BG = "#EEF2F6"
BORDER = "#D7DEE6"
TEXT = "#1B2733"
MUTED = "#5B6B7A"
RED = "#C62F1D"
AMBER = "#B4690E"
BLUE = "#1E5FA8"

# -----------------------------------------------------------------------------
# DEMO DATA
# In the final system, these records would come from the City's backend/API.
# The current capstone demo uses simulated records.
# -----------------------------------------------------------------------------
POTHOLES = [
    dict(
        id="PTH-2026-00841",
        location="Hoshangabad Road, Misrod",
        ward="Ward 76",
        lat=23.16083,
        lng=77.46833,
        detections=340,
        segment="HBR-RD-042",
        last_detected="02 Sep 2026 · 11:58 AM",
    ),
    dict(
        id="PTH-2026-00812",
        location="MP Nagar Zone II",
        ward="Ward 42",
        lat=23.22830,
        lng=77.43649,
        detections=190,
        segment="MPN-RD-011",
        last_detected="01 Sep 2026 · 09:12 AM",
    ),
    dict(
        id="PTH-2026-00799",
        location="Govindpura Main Road",
        ward="Ward 58",
        lat=23.20944,
        lng=77.44778,
        detections=120,
        segment="GVP-RD-004",
        last_detected="31 Aug 2026 · 06:40 PM",
    ),
    dict(
        id="PTH-2026-00775",
        location="New Market, TT Nagar",
        ward="Ward 24",
        lat=23.24170,
        lng=77.40120,
        detections=41,
        segment="NMK-RD-002",
        last_detected="30 Aug 2026 · 08:05 AM",
    ),
    dict(
        id="PTH-2026-00760",
        location="Indrapuri, Raisen Road",
        ward="Ward 64",
        lat=23.25194,
        lng=77.46194,
        detections=16,
        segment="INP-RD-007",
        last_detected="29 Aug 2026 · 05:22 PM",
    ),
    dict(
        id="PTH-2026-00744",
        location="Ayodhya Bypass, near Bairagarh",
        ward="Ward 5",
        lat=23.29500,
        lng=77.35500,
        detections=3,
        segment="AYB-RD-019",
        last_detected="28 Aug 2026 · 07:51 AM",
    ),
]

EMPLOYEES = [
    {"name": "Rajesh Sharma", "role": "Road Inspection Officer", "team": "North Zone Team"},
    {"name": "Amit Verma", "role": "Field Engineer", "team": "Central Zone Team"},
    {"name": "Priya Singh", "role": "Road Maintenance Officer", "team": "South Zone Team"},
    {"name": "Vikram Patel", "role": "Field Supervisor", "team": "Central Zone Team"},
    {"name": "Neha Tiwari", "role": "Junior Engineer", "team": "South Zone Team"},
]

TEAMS = [
    "North Zone Team",
    "Central Zone Team",
    "South Zone Team",
    "Emergency Road Team",
]

BHOPAL_CENTER = [23.2599, 77.4126]

# -----------------------------------------------------------------------------
# SESSION STATE
# -----------------------------------------------------------------------------
if "page" not in st.session_state:
    st.session_state.page = "dashboard"
if "selected_pothole" not in st.session_state:
    st.session_state.selected_pothole = POTHOLES[0]["id"]
if "threshold" not in st.session_state:
    st.session_state.threshold = 20
if "assignments" not in st.session_state:
    st.session_state.assignments = {}

POTHOLE_BY_ID = {p["id"]: p for p in POTHOLES}

# -----------------------------------------------------------------------------
# HELPERS
# -----------------------------------------------------------------------------
def status_for(pothole):
    count = pothole["detections"]
    threshold = st.session_state.threshold
    if count >= threshold:
        return "Confirmed"
    return "Under Review"


def priority_for(pothole):
    count = pothole["detections"]
    threshold = st.session_state.threshold
    if count >= max(100, threshold):
        return "Critical"
    if count >= max(50, threshold):
        return "High"
    if count >= threshold:
        return "Medium"
    return "Review"


def assignment_for(pothole_id):
    return st.session_state.assignments.get(pothole_id, "Unassigned")


def go(page, pothole_id=None):
    st.session_state.page = page
    if pothole_id:
        st.session_state.selected_pothole = pothole_id


def status_badge(status):
    if status == "Confirmed":
        bg, fg = "#DFF2E6", GREEN
    else:
        bg, fg = "#E1EDF9", BLUE
    return f'<span class="badge" style="background:{bg};color:{fg};">{status}</span>'


def priority_badge(priority):
    styles = {
        "Critical": ("#FBE4E1", RED),
        "High": ("#FBEBD6", AMBER),
        "Medium": ("#F7F1D4", "#8A7A0A"),
        "Review": ("#E1EDF9", BLUE),
    }
    bg, fg = styles[priority]
    return f'<span class="badge" style="background:{bg};color:{fg};">{priority}</span>'


def make_map(potholes, selected_id=None):
    m = folium.Map(
        location=BHOPAL_CENTER,
        zoom_start=11,
        tiles="OpenStreetMap",
        control_scale=True,
    )

    for p in potholes:
        status = status_for(p)
        priority = priority_for(p)
        is_selected = p["id"] == selected_id

        if priority == "Critical":
            marker_color = "red"
        elif priority == "High":
            marker_color = "orange"
        elif priority == "Medium":
            marker_color = "green"
        else:
            marker_color = "blue"

        assigned = assignment_for(p["id"])
        popup_html = f"""
        <div style='font-family:Arial,sans-serif;min-width:220px;'>
            <b>{p['location']}</b><br>
            <span>{p['ward']} · {p['id']}</span><br><br>
            <b>Detections:</b> {p['detections']}<br>
            <b>Status:</b> {status}<br>
            <b>Priority:</b> {priority}<br>
            <b>Assignment:</b> {assigned}
        </div>
        """

        folium.Marker(
            [p["lat"], p["lng"]],
            tooltip=f"{p['location']} · {p['detections']} detections",
            popup=folium.Popup(popup_html, max_width=300),
            icon=folium.Icon(color=marker_color, icon="warning-sign", prefix="glyphicon"),
        ).add_to(m)

        if is_selected:
            folium.Circle(
                [p["lat"], p["lng"]],
                radius=220,
                color=NAVY,
                fill=False,
                weight=3,
            ).add_to(m)

    return m


def kpi_card(label, value, note):
    st.markdown(
        f"""
        <div class="kpi">
            <div class="kpi-label">{label}</div>
            <div class="kpi-value">{value}</div>
            <div class="kpi-note">{note}</div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# -----------------------------------------------------------------------------
# GLOBAL CSS
# -----------------------------------------------------------------------------
st.markdown(
    f"""
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

        html, body, [class*="css"] {{
            font-family: 'Noto Sans', sans-serif;
        }}

        .stApp {{ background: {BG}; color: {TEXT}; }}
        .block-container {{ padding-top: 1.2rem; padding-bottom: 2rem; max-width: 1500px; }}

        /* Streamlit chrome */
        header[data-testid="stHeader"] {{
            background: {NAVY_DARK};
        }}
        header[data-testid="stHeader"] button {{
            color: #ffffff !important;
        }}
        [data-testid="stToolbar"] {{
            color: #ffffff !important;
        }}

        /* Sidebar */
        [data-testid="stSidebar"] {{
            background: linear-gradient(180deg, {NAVY_DARK} 0%, {NAVY} 100%);
            border-right: 1px solid #123E61;
        }}
        [data-testid="stSidebar"] > div:first-child {{
            padding-top: 1.25rem;
        }}
        [data-testid="stSidebar"] .brand {{
            font-size: 23px;
            font-weight: 700;
            color: #ffffff;
            margin-bottom: 2px;
        }}
        [data-testid="stSidebar"] .brand-sub {{
            font-size: 10.5px;
            color: #C9D8E5;
            letter-spacing: .9px;
            text-transform: uppercase;
        }}
        [data-testid="stSidebar"] .nav-section {{
            font-size: 10.5px;
            color: #BFD0DE;
            font-weight: 700;
            letter-spacing: 1.3px;
            margin: 25px 0 8px;
            text-transform: uppercase;
        }}
        [data-testid="stSidebar"] .stButton > button {{
            background: transparent !important;
            color: #F7FAFC !important;
            border: 1px solid transparent !important;
            border-radius: 7px !important;
            text-align: left !important;
            font-weight: 600 !important;
            min-height: 43px;
            box-shadow: none !important;
        }}
        [data-testid="stSidebar"] .stButton > button:hover {{
            background: rgba(255,255,255,.10) !important;
            border-color: rgba(255,255,255,.12) !important;
            color: #ffffff !important;
        }}
        [data-testid="stSidebar"] .stButton > button:focus {{
            background: #123F67 !important;
            color: #ffffff !important;
            border-color: #4E86B4 !important;
        }}
        [data-testid="stSidebar"] label,
        [data-testid="stSidebar"] .stMarkdown,
        [data-testid="stSidebar"] .stCaption,
        [data-testid="stSidebar"] p {{
            color: #E7EEF4 !important;
        }}
        [data-testid="stSidebar"] [data-baseweb="select"] > div,
        [data-testid="stSidebar"] input {{
            background: #0B2F4E !important;
            color: #ffffff !important;
            border-color: #507694 !important;
        }}
        [data-testid="stSidebar"] hr {{ border-color: rgba(255,255,255,.16); }}

        /* Main headings */
        .page-title {{
            font-size: 31px;
            line-height: 1.15;
            color: {NAVY_DARK};
            font-weight: 700;
            margin: 0;
        }}
        .page-subtitle {{
            color: {MUTED};
            font-size: 14px;
            margin-top: 7px;
            margin-bottom: 18px;
        }}

        .kpi {{
            background: #ffffff;
            border: 1px solid {BORDER};
            border-radius: 8px;
            padding: 16px 17px;
            min-height: 112px;
            box-shadow: 0 1px 2px rgba(0,0,0,.03);
        }}
        .kpi-label {{ color: {MUTED}; font-size: 12px; font-weight: 600; }}
        .kpi-value {{ color: {NAVY_DARK}; font-size: 29px; font-weight: 700; margin-top: 5px; }}
        .kpi-note {{ color: #7C8995; font-size: 11px; margin-top: 2px; }}

        /* Real panels: these are used only around HTML blocks, never as an
           opening tag that spans multiple Streamlit elements. This prevents
           the mysterious blank white bars seen in the previous version. */
        .panel {{
            background: #ffffff;
            border: 1px solid {BORDER};
            border-radius: 9px;
            padding: 18px;
            margin-top: 16px;
            box-shadow: 0 1px 2px rgba(0,0,0,.025);
        }}
        .panel:empty {{ display:none !important; }}
        .section-title {{
            color: {NAVY_DARK};
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 3px;
        }}
        .section-sub {{ color: {MUTED}; font-size: 12px; margin-bottom: 13px; }}

        .badge {{
            display: inline-block;
            padding: 3px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
        }}
        .mono {{ font-family: 'IBM Plex Mono', monospace; }}
        .small-muted {{ color: {MUTED}; font-size: 12px; }}

        /* Native Streamlit controls */
        .stButton > button {{
            color: {NAVY_DARK} !important;
            background: #ffffff !important;
            border: 1px solid #AEBFCE !important;
            font-weight: 600 !important;
            border-radius: 7px !important;
        }}
        .stButton > button:hover {{
            border-color: {NAVY} !important;
            color: {NAVY} !important;
        }}
        .stButton > button[kind="primary"],
        .stButton > button[data-testid="baseButton-primary"] {{
            background: {NAVY} !important;
            color: #ffffff !important;
            border-color: {NAVY} !important;
        }}
        .stButton > button[kind="primary"] p,
        .stButton > button[data-testid="baseButton-primary"] p {{
            color: #ffffff !important;
        }}
        .stTextInput label, .stSelectbox label, .stNumberInput label {{
            color: {NAVY_DARK} !important;
            font-weight: 600 !important;
        }}
        .stTextInput input, .stNumberInput input {{
            color: {TEXT} !important;
            background: #ffffff !important;
        }}
        [data-baseweb="select"] > div {{
            background: #ffffff !important;
            color: {TEXT} !important;
            border-color: #AEBFCE !important;
        }}
        [data-baseweb="select"] span {{ color: {TEXT} !important; }}
        [data-testid="stMetricLabel"] {{ color: {MUTED} !important; }}
        [data-testid="stMetricValue"] {{ color: {NAVY_DARK} !important; }}
        [data-testid="stAlert"] p {{ color: {TEXT} !important; }}

        [data-testid="stMarkdownContainer"]:has(> div.panel:empty),
        [data-testid="stMarkdownContainer"]:has(> div:not(.panel):empty) {{
            min-height: 0 !important;
        }}

        .gov-footer {{
            margin-top: 28px;
            padding: 18px 20px;
            background: {NAVY_DARK};
            color: #ffffff;
            border-radius: 7px;
            font-size: 12px;
        }}
        .gov-footer .fine {{
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,.18);
            color: #C8D4DE;
            font-size: 10.5px;
            line-height: 1.5;
        }}
    </style>
    """,
    unsafe_allow_html=True,
)

# -----------------------------------------------------------------------------
# SIDEBAR
# -----------------------------------------------------------------------------
with st.sidebar:
    st.markdown('<div class="brand">CityFlow AI</div>', unsafe_allow_html=True)
    st.markdown('<div class="brand-sub">Municipal Road Maintenance</div>', unsafe_allow_html=True)

    st.markdown('<div class="nav-section">Road Issues</div>', unsafe_allow_html=True)
    nav_items = [
        ("dashboard", "▦  Dashboard"),
        ("reports", "≡  Pothole Reports"),
        ("priority", "▲  Priority & Confirmed"),
        ("assignments", "✓  Work Assignments"),
    ]
    for key, label in nav_items:
        if st.button(label, key=f"nav_{key}", use_container_width=True):
            go(key)

    st.markdown('<div class="nav-section">Municipal Staff</div>', unsafe_allow_html=True)
    if st.button("◉  Employees & Teams", key="nav_staff", use_container_width=True):
        go("staff")

    st.markdown('<div class="nav-section">Validation Rule</div>', unsafe_allow_html=True)
    threshold = st.number_input(
        "Confirmation threshold (detections)",
        min_value=1,
        max_value=500,
        value=st.session_state.threshold,
        step=1,
        help="A pothole reaches Confirmed status when repeated detections meet or exceed this threshold.",
    )
    st.session_state.threshold = threshold
    st.caption("Below threshold → Under Review\n\nAt/above threshold → Confirmed")

    st.markdown("---")
    st.caption("Prototype data · Bhopal demonstration")

# -----------------------------------------------------------------------------
# PAGES
# -----------------------------------------------------------------------------
def page_dashboard():
    total = len(POTHOLES)
    confirmed = sum(status_for(p) == "Confirmed" for p in POTHOLES)
    high_priority = sum(priority_for(p) in {"Critical", "High"} for p in POTHOLES)
    unassigned = sum(assignment_for(p["id"]) == "Unassigned" for p in POTHOLES if status_for(p) == "Confirmed")

    st.markdown('<h1 class="page-title">Municipal Pothole Intelligence Dashboard</h1>', unsafe_allow_html=True)
    st.markdown(
        '<div class="page-subtitle">Automatically detected road-impact reports, confirmation status, priority and field-work assignment for municipal road maintenance.</div>',
        unsafe_allow_html=True,
    )

    cols = st.columns(4)
    with cols[0]:
        kpi_card("Detected Potholes", str(total), "Current demonstration feed")
    with cols[1]:
        kpi_card("Confirmed", str(confirmed), f"≥ {st.session_state.threshold} detections")
    with cols[2]:
        kpi_card("High / Critical", str(high_priority), "Needs faster inspection")
    with cols[3]:
        kpi_card("Awaiting Assignment", str(unassigned), "Confirmed issues")

    left, right = st.columns([2.8, 1])
    with left:
        with st.container(border=True):
            st.markdown('<div class="section-title">Pothole Detection Map — Bhopal</div>', unsafe_allow_html=True)
            st.markdown(
                '<div class="section-sub">Each marker represents a detected road-impact location. Repeated detections increase confidence and priority.</div>',
                unsafe_allow_html=True,
            )
            st_folium(make_map(POTHOLES), use_container_width=True, height=430, returned_objects=[])

    with right:
        with st.container(border=True):
            st.markdown('<div class="section-title">Priority Queue</div>', unsafe_allow_html=True)
            st.markdown('<div class="section-sub">Highest repeated detections first.</div>', unsafe_allow_html=True)
            for pothole in sorted(POTHOLES, key=lambda x: x["detections"], reverse=True)[:5]:
                st.markdown(
                    f"""
                    <div style='padding:10px 0;border-bottom:1px solid {BORDER};'>
                        <div style='font-weight:700;font-size:13px;color:{NAVY_DARK};'>{pothole['location']}</div>
                        <div class='small-muted'>{pothole['ward']} · <span class='mono'>{pothole['detections']}</span> detections</div>
                        <div style='margin-top:5px;'>{priority_badge(priority_for(pothole))} &nbsp; {status_badge(status_for(pothole))}</div>
                    </div>
                    """,
                    unsafe_allow_html=True,
                )

    with st.container(border=True):
        st.markdown('<div class="section-title">Municipal Workflow</div>', unsafe_allow_html=True)
        st.markdown(
            f"""
            <div style='display:flex;gap:14px;flex-wrap:wrap;margin-top:10px;'>
                <div style='flex:1;min-width:190px;border:1px solid {BORDER};border-radius:7px;padding:13px;'>
                    <b>1. Detect</b><br><span class='small-muted'>A road-impact event is received from the CityFlow sensor pipeline.</span>
                </div>
                <div style='flex:1;min-width:190px;border:1px solid {BORDER};border-radius:7px;padding:13px;'>
                    <b>2. Repeat</b><br><span class='small-muted'>Detections from different trips accumulate at the same road location.</span>
                </div>
                <div style='flex:1;min-width:190px;border:1px solid {BORDER};border-radius:7px;padding:13px;'>
                    <b>3. Confirm</b><br><span class='small-muted'>At least <b>{st.session_state.threshold}</b> detections → confirmed road issue.</span>
                </div>
                <div style='flex:1;min-width:190px;border:1px solid {BORDER};border-radius:7px;padding:13px;'>
                    <b>4. Assign</b><br><span class='small-muted'>A municipal employee or field team is assigned for inspection.</span>
                </div>
            </div>
            """,
            unsafe_allow_html=True,
        )


def page_reports():
    st.markdown('<h1 class="page-title">Pothole Reports</h1>', unsafe_allow_html=True)
    st.markdown(
        '<div class="page-subtitle">All automatically detected road-impact locations, with repeated detections used for confirmation and priority.</div>',
        unsafe_allow_html=True,
    )

    c1, c2, c3 = st.columns([1.5, 1.2, 1])
    with c1:
        search = st.text_input("Search location / report ID", placeholder="e.g. MP Nagar or PTH-2026")
    with c2:
        status_filter = st.selectbox("Status", ["All", "Confirmed", "Under Review"])
    with c3:
        priority_filter = st.selectbox("Priority", ["All", "Critical", "High", "Medium", "Review"])

    filtered = []
    for pothole in POTHOLES:
        status = status_for(pothole)
        priority = priority_for(pothole)
        text = f"{pothole['location']} {pothole['id']} {pothole['ward']}".lower()
        if search and search.lower() not in text:
            continue
        if status_filter != "All" and status != status_filter:
            continue
        if priority_filter != "All" and priority != priority_filter:
            continue
        filtered.append(pothole)

    with st.container(border=True):
        st.markdown(f'<div class="section-title">{len(filtered)} report(s)</div>', unsafe_allow_html=True)
        st.markdown('<div class="section-sub">Select a report to inspect its location and assign municipal field work.</div>', unsafe_allow_html=True)

        for pothole in sorted(filtered, key=lambda x: x["detections"], reverse=True):
            status = status_for(pothole)
            priority = priority_for(pothole)
            assigned = assignment_for(pothole["id"])
            c1, c2, c3, c4, c5 = st.columns([2.4, 1, 1, 1.5, 1.2])
            with c1:
                st.markdown(f"**{pothole['location']}**  \n`{pothole['id']}` · {pothole['ward']} · `{pothole['segment']}`")
            with c2:
                st.markdown(f"**{pothole['detections']}**  \n<small>detections</small>", unsafe_allow_html=True)
            with c3:
                st.markdown(f"{status_badge(status)}<br>{priority_badge(priority)}", unsafe_allow_html=True)
            with c4:
                st.markdown(f"<small>Assigned</small><br><b>{assigned}</b>", unsafe_allow_html=True)
            with c5:
                if st.button("View / Assign", key=f"view_{pothole['id']}", use_container_width=True):
                    go("detail", pothole["id"])
                    st.rerun()
            st.divider()


def page_priority():
    confirmed = [pothole for pothole in POTHOLES if status_for(pothole) == "Confirmed"]
    confirmed.sort(key=lambda x: x["detections"], reverse=True)

    st.markdown('<h1 class="page-title">Priority & Confirmed Issues</h1>', unsafe_allow_html=True)
    st.markdown(
        f'<div class="page-subtitle">Issues at or above the <b>{st.session_state.threshold}-detection threshold</b> are treated as confirmed. Higher repeated detections move an issue up the action queue.</div>',
        unsafe_allow_html=True,
    )

    if not confirmed:
        st.info("No pothole has reached the confirmation threshold yet.")
        return

    with st.container(border=True):
        st.markdown('<div class="section-title">Municipal Action Queue</div>', unsafe_allow_html=True)
        st.markdown('<div class="section-sub">Sort order is based on repeated detections.</div>', unsafe_allow_html=True)

        for index, pothole in enumerate(confirmed, start=1):
            priority = priority_for(pothole)
            assigned = assignment_for(pothole["id"])
            c1, c2, c3, c4, c5 = st.columns([0.5, 2.4, 1, 1.1, 1.3])
            with c1:
                st.markdown(f"### {index}")
            with c2:
                st.markdown(f"**{pothole['location']}**  \n`{pothole['id']}` · {pothole['ward']}")
            with c3:
                st.markdown(f"**{pothole['detections']}** detections")
            with c4:
                st.markdown(priority_badge(priority) + "<br>" + status_badge("Confirmed"), unsafe_allow_html=True)
            with c5:
                st.markdown(f"<small>Assigned</small><br><b>{assigned}</b>", unsafe_allow_html=True)
            st.divider()


def page_assignments():
    confirmed = [pothole for pothole in POTHOLES if status_for(pothole) == "Confirmed"]
    confirmed.sort(key=lambda x: x["detections"], reverse=True)

    st.markdown('<h1 class="page-title">Work Assignments</h1>', unsafe_allow_html=True)
    st.markdown(
        '<div class="page-subtitle">Assign a confirmed pothole to a municipal employee or field team for on-site inspection.</div>',
        unsafe_allow_html=True,
    )

    if not confirmed:
        st.info("Confirmed potholes will appear here after they cross the detection threshold.")
        return

    for pothole in confirmed:
        assigned = assignment_for(pothole["id"])
        with st.container(border=True):
            c1, c2 = st.columns([2.2, 1.5])
            with c1:
                st.markdown(f"### {pothole['location']}")
                st.caption(f"{pothole['id']} · {pothole['ward']} · {pothole['segment']}")
                st.write(f"**{pothole['detections']} repeated detections** · {priority_for(pothole)} priority")
                st.write(f"Last detected: {pothole['last_detected']}")
            with c2:
                options = ["Unassigned"] + [e["name"] for e in EMPLOYEES] + [f"Team — {t}" for t in TEAMS]
                current_index = options.index(assigned) if assigned in options else 0
                choice = st.selectbox("Assign to", options, index=current_index, key=f"assign_select_{pothole['id']}")
                if st.button("Save Assignment", key=f"save_assign_{pothole['id']}", use_container_width=True):
                    st.session_state.assignments[pothole["id"]] = choice
                    st.success(f"Assigned to {choice}.")
                    st.rerun()


def page_staff():
    st.markdown('<h1 class="page-title">Employees & Teams</h1>', unsafe_allow_html=True)
    st.markdown(
        '<div class="page-subtitle">Municipal field staff available for pothole inspection and road-maintenance assignments.</div>',
        unsafe_allow_html=True,
    )

    with st.container(border=True):
        st.markdown('<div class="section-title">Employees</div>', unsafe_allow_html=True)
        df = pd.DataFrame(EMPLOYEES)
        df.columns = ["Employee", "Role", "Team"]
        st.dataframe(df, use_container_width=True, hide_index=True)

    with st.container(border=True):
        st.markdown('<div class="section-title">Field Teams</div>', unsafe_allow_html=True)
        for team in TEAMS:
            members = [e["name"] for e in EMPLOYEES if e["team"] == team]
            st.markdown(
                f"**{team}**  \n<span class='small-muted'>{', '.join(members) if members else 'Team roster managed by municipality'}</span>",
                unsafe_allow_html=True,
            )
            st.divider()


def page_detail():
    p = POTHOLE_BY_ID[st.session_state.selected_pothole]
    status = status_for(p)
    priority = priority_for(p)
    assigned = assignment_for(p["id"])

    st.markdown('<h1 class="page-title">Pothole Report Detail</h1>', unsafe_allow_html=True)
    st.markdown(
        f'<div class="page-subtitle">Report <span class="mono">{p["id"]}</span> · municipal inspection record</div>',
        unsafe_allow_html=True,
    )

    if st.button("← Back to reports"):
        go("reports")
        st.rerun()

    left, right = st.columns([1.7, 1])
    with left:
        with st.container(border=True):
            st.markdown(f'<div class="section-title">{p["location"]}</div>', unsafe_allow_html=True)
            st.markdown(f'<div class="section-sub">{p["ward"]} · Road segment {p["segment"]}</div>', unsafe_allow_html=True)
            st_folium(make_map([p], selected_id=p["id"]), use_container_width=True, height=360, returned_objects=[])

    with right:
        with st.container(border=True):
            st.markdown('<div class="section-title">Validation</div>', unsafe_allow_html=True)
            st.metric("Repeated detections", p["detections"])
            st.markdown(f"**Confirmation threshold:** {st.session_state.threshold}")
            st.markdown(f"**Status:** {status_badge(status)}", unsafe_allow_html=True)
            st.markdown(f"**Priority:** {priority_badge(priority)}", unsafe_allow_html=True)
            st.markdown(f"**Last detected:** {p['last_detected']}")

        with st.container(border=True):
            st.markdown('<div class="section-title">Assign Field Work</div>', unsafe_allow_html=True)
            options = ["Unassigned"] + [e["name"] for e in EMPLOYEES] + [f"Team — {t}" for t in TEAMS]
            current_index = options.index(assigned) if assigned in options else 0
            choice = st.selectbox("Employee / Team", options, index=current_index, key=f"detail_assign_{p['id']}")
            if st.button("Assign this pothole", type="primary", use_container_width=True):
                st.session_state.assignments[p["id"]] = choice
                st.success(f"{p['id']} assigned to {choice}.")
                st.rerun()

def gov_footer():
    st.markdown(
        f"""
        <div class="gov-footer">
            <div style="display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;">
                <div><strong>CityFlow AI — Municipal Road Maintenance</strong><br>Student Capstone Demonstration</div>
                <div>Bhopal road-condition prototype<br>Road Issue Monitoring · Field Assignment</div>
            </div>
            <div class="fine">
                This is a student capstone demonstration prototype. It is not an official Government of Madhya Pradesh
                or Bhopal Municipal Corporation system, is not connected to a live municipal database, and the report
                records shown are simulated. The interface is designed to demonstrate how automatically generated
                pothole reports could be received, validated and assigned by a municipal road-maintenance department.
            </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# -----------------------------------------------------------------------------
# ROUTER
# -----------------------------------------------------------------------------
PAGES = {
    "dashboard": page_dashboard,
    "reports": page_reports,
    "priority": page_priority,
    "assignments": page_assignments,
    "staff": page_staff,
    "detail": page_detail,
}

PAGES.get(st.session_state.page, page_dashboard)()
gov_footer()
