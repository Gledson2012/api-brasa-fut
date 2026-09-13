import { db, client } from "../src/db/index.js";
import { competitions, seasons } from "../src/db/schema.js";
import { eq } from "drizzle-orm";

interface CompetitionDef {
  name: string;
  code: string;
  country: string;
  type: "LEAGUE" | "CUP" | "INTERNATIONAL";
  logoUrl?: string;
  seasonName?: string;
  startDate?: string;
  endDate?: string;
}

const ALL_COMPETITIONS: CompetitionDef[] = [
  // ==========================================
  // 1. BRASIL
  // ==========================================
  { name: "Brasileirão Série A", code: "BRA-1", country: "Brasil", type: "LEAGUE", logoUrl: "https://api.sofascore.app/api/v1/unique-tournament/325/image" },
  { name: "Brasileirão Série B", code: "BRA-2", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/f/f4/Campeonato_Brasileiro_S%C3%A9rie_B_logo.png" },
  { name: "Brasileirão Série C", code: "BRA-3", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/bd/Campeonato_Brasileiro_S%C3%A9rie_C_logo.png" },
  { name: "Brasileirão Série D", code: "BRA-4", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/d/da/Campeonato_Brasileiro_S%C3%A9rie_D_logo.png" },
  { name: "Copa do Brasil", code: "CDB", country: "Brasil", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/9/9e/Copa_do_Brasil_de_Futebol_logo.png" },
  { name: "Supercopa Rei", code: "SCB", country: "Brasil", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/41/Supercopa_do_Brasil_logo.png" },
  { name: "Copa do Nordeste", code: "CNE", country: "Brasil", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/a/a2/Copa_do_Nordeste_logo.png" },
  { name: "Copa Verde", code: "COPA-VERDE", country: "Brasil", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/e/eb/Copa_Verde_logo.png" },
  { name: "Campeonato Paulista", code: "PAULISTAO", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/3/30/Campeonato_Paulista_logo.png" },
  { name: "Campeonato Carioca", code: "CARIOCAO", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/8/8f/Campeonato_Carioca_logo.png" },
  { name: "Campeonato Mineiro", code: "MINEIRO", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b2/Campeonato_Mineiro_logo.png" },
  { name: "Campeonato Gaúcho", code: "GAUCHAO", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/9/90/Campeonato_Gaucho_logo.png" },
  { name: "Campeonato Paranaense", code: "PARANAENSE", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/4e/Campeonato_Paranaense_logo.png" },
  { name: "Campeonato Catarinense", code: "CATARINENSE", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/3/36/Campeonato_Catarinense_logo.png" },
  { name: "Campeonato Baiano", code: "BAIANO", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b3/Campeonato_Baiano_logo.png" },
  { name: "Campeonato Pernambucano", code: "PERNAMBUCANO", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/e/e6/Campeonato_Pernambucano_logo.png" },
  { name: "Campeonato Goiano", code: "GOIANO", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/7/7b/Campeonato_Goiano_logo.png" },
  { name: "Campeonato Cearense", code: "CEARENSE", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/a/a9/Campeonato_Cearense_logo.png" },
  { name: "Brasileirão Feminino A1", code: "BRA-FEM-1", country: "Brasil", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/6/6c/Campeonato_Brasileiro_Feminino_logo.png" },

  // ==========================================
  // 2. INGLATERRA
  // ==========================================
  { name: "Premier League", code: "PL", country: "Inglaterra", type: "LEAGUE", logoUrl: "https://api.sofascore.app/api/v1/unique-tournament/17/image" },
  { name: "EFL Championship", code: "ENG-2", country: "Inglaterra", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a9/EFL_Championship.svg" },
  { name: "FA Cup (Copa da Inglaterra)", code: "ENG-FAC", country: "Inglaterra", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b4/Emirates_FA_Cup_Logo.svg" },
  { name: "EFL Carabao Cup", code: "ENG-EFLC", country: "Inglaterra", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/d2/Carabao_Cup_Logo.svg" },
  { name: "FA Community Shield", code: "ENG-CS", country: "Inglaterra", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/ae/FA_Community_Shield_logo.svg" },

  // ==========================================
  // 3. ESPANHA
  // ==========================================
  { name: "La Liga", code: "LAL", country: "Espanha", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/LaLiga_logo_2023.svg" },
  { name: "La Liga 2 (Hypermotion)", code: "ESP-2", country: "Espanha", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/LaLiga_logo_2023.svg" },
  { name: "Copa del Rey", code: "ESP-CDR", country: "Espanha", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/c/ce/Copa_del_Rey_logo.svg" },
  { name: "Supercopa de España", code: "ESP-SC", country: "Espanha", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b5/Supercopa_de_Espa%C3%B1a_logo.svg" },

  // ==========================================
  // 4. ITÁLIA
  // ==========================================
  { name: "Serie A Italiana", code: "SA-ITA", country: "Itália", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Serie_A_logo_2019.svg" },
  { name: "Serie B Italiana", code: "ITA-2", country: "Itália", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/9/90/Serie_B_logo_%282020%29.svg" },
  { name: "Coppa Italia", code: "ITA-CI", country: "Itália", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/d4/Coppa_Italia_logo_%282021%29.svg" },
  { name: "Supercoppa Italiana", code: "ITA-SI", country: "Itália", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/4/4b/Supercoppa_Italiana_logo_%282021%29.svg" },

  // ==========================================
  // 5. ALEMANHA
  // ==========================================
  { name: "Bundesliga", code: "BUN", country: "Alemanha", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg" },
  { name: "2. Bundesliga", code: "GER-2", country: "Alemanha", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/df/Bundesliga_logo_%282017%29.svg" },
  { name: "DFB-Pokal (Copa da Alemanha)", code: "GER-DFB", country: "Alemanha", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/DFB-Pokal_logo_%282016%29.svg" },
  { name: "DFL-Supercup", code: "GER-SC", country: "Alemanha", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/ae/DFL-Supercup.svg" },

  // ==========================================
  // 6. FRANÇA
  // ==========================================
  { name: "Ligue 1", code: "LIG-1", country: "França", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Ligue_1_logo_%282024%29.svg" },
  { name: "Ligue 2", code: "FRA-2", country: "França", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/Ligue_1_logo_%282024%29.svg" },
  { name: "Coupe de France", code: "FRA-CDF", country: "França", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/8/8c/Coupe_de_France_logo_%282018%29.svg" },
  { name: "Trophée des Champions", code: "FRA-TC", country: "França", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/5/51/Trophee_des_Champions.svg" },

  // ==========================================
  // 7. PORTUGAL
  // ==========================================
  { name: "Primeira Liga", code: "POR-1", country: "Portugal", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/4b/Liga_Portugal_Betclic_logo.png" },
  { name: "Liga Portugal 2", code: "POR-2", country: "Portugal", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/4b/Liga_Portugal_Betclic_logo.png" },
  { name: "Taça de Portugal", code: "POR-TDP", country: "Portugal", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/2/2c/Ta%C3%A7a_de_Portugal_logo.png" },
  { name: "Taça da Liga", code: "POR-TDL", country: "Portugal", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/e/ed/Ta%C3%A7a_da_Liga_logo.png" },
  { name: "Supertaça Cândido de Oliveira", code: "POR-SC", country: "Portugal", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/4b/Liga_Portugal_Betclic_logo.png" },

  // ==========================================
  // 8. HOLANDA (PAÍSES BAIXOS)
  // ==========================================
  { name: "Eredivisie", code: "NED-1", country: "Holanda", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Eredivisie_nieuw_logo_2017-.svg" },
  { name: "KNVB Beker", code: "NED-CUP", country: "Holanda", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/69/KNVB_Beker_logo.svg" },
  { name: "Johan Cruyff Shield", code: "NED-SC", country: "Holanda", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/0/0f/Eredivisie_nieuw_logo_2017-.svg" },

  // ==========================================
  // 9. BÉLGICA
  // ==========================================
  { name: "Belgian Pro League (Jupiler)", code: "BEL-1", country: "Bélgica", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/6/6b/Jupiler_Pro_League_logo.svg" },
  { name: "Croky Cup (Copa da Bélgica)", code: "BEL-CUP", country: "Bélgica", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/6/67/Belgian_Cup_logo.svg" },

  // ==========================================
  // 10. TURQUIA
  // ==========================================
  { name: "Süper Lig", code: "TUR-1", country: "Turquia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/f3/S%C3%BCper_Lig_logo.svg" },
  { name: "Türkiye Kupası (Copa da Turquia)", code: "TUR-CUP", country: "Turquia", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b6/Turkish_Cup_logo.svg" },

  // ==========================================
  // 11. ESCÓCIA & GRÉCIA
  // ==========================================
  { name: "Scottish Premiership", code: "SCO-1", country: "Escócia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/2/29/Scottish_Premiership.svg" },
  { name: "Scottish Cup", code: "SCO-CUP", country: "Escócia", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/2/29/Scottish_Premiership.svg" },
  { name: "Super League Greece", code: "GRE-1", country: "Grécia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/7/75/Super_League_Greece_logo.svg" },
  { name: "Greek Cup", code: "GRE-CUP", country: "Grécia", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/7/75/Super_League_Greece_logo.svg" },

  // ==========================================
  // 12. ESTADOS UNIDOS & CANADÁ
  // ==========================================
  { name: "Major League Soccer (MLS)", code: "USA-MLS", country: "Estados Unidos", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/76/MLS_crest_logo_RGB_gradient.svg" },
  { name: "US Open Cup", code: "USA-USOC", country: "Estados Unidos", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/8/87/Lamar_Hunt_U.S._Open_Cup_logo.svg" },
  { name: "Leagues Cup", code: "USA-LC", country: "América do Norte", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/9/9c/Leagues_Cup_Logo.svg" },
  { name: "National Women's Soccer League", code: "NWSL", country: "Estados Unidos", type: "LEAGUE", logoUrl: "https://api.sofascore.app/api/v1/unique-tournament/1690/image" },

  // ==========================================
  // 13. ARGENTINA
  // ==========================================
  { name: "Liga Profesional de Fútbol", code: "ARG-1", country: "Argentina", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/Liga_Profesional_de_F%C3%BAtbol_logo.svg" },
  { name: "Copa de la Liga Profesional", code: "ARG-CLP", country: "Argentina", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/Liga_Profesional_de_F%C3%BAtbol_logo.svg" },
  { name: "Copa Argentina", code: "ARG-CA", country: "Argentina", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/15/Copa_Argentina_logo.svg" },
  { name: "Trofeo de Campeones", code: "ARG-TC", country: "Argentina", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/36/Liga_Profesional_de_F%C3%BAtbol_logo.svg" },

  // ==========================================
  // 14. URUGUAI, COLÔMBIA, CHILE, EQUADOR
  // ==========================================
  { name: "Primera División Uruguaya", code: "URU-1", country: "Uruguai", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/4b/Campeonato_Uruguaio_logo.png" },
  { name: "Copa Uruguay", code: "URU-CUP", country: "Uruguai", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/4/4b/Campeonato_Uruguaio_logo.png" },
  { name: "Liga BetPlay Dimayor", code: "COL-1", country: "Colômbia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Liga_BetPlay_Dimayor_logo.svg" },
  { name: "Copa Colombia", code: "COL-CUP", country: "Colômbia", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/16/Liga_BetPlay_Dimayor_logo.svg" },
  { name: "Primera División de Chile", code: "CHI-1", country: "Chile", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Primera_Divisi%C3%B3n_de_Chile_logo_2024.svg" },
  { name: "Copa Chile", code: "CHI-CUP", country: "Chile", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Primera_Divisi%C3%B3n_de_Chile_logo_2024.svg" },
  { name: "LigaPro Serie A", code: "ECU-1", country: "Equador", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/LigaPro_Ecuador_logo.svg" },
  { name: "Primera División de Paraguay", code: "PAR-1", country: "Paraguai", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f8/Primera_Divisi%C3%B3n_de_Paraguay_logo.svg" },
  { name: "Liga 1 Te Apuesto", code: "PER-1", country: "Peru", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/7/7b/Liga_1_Te_Apuesto_logo.svg" },
  { name: "División Profesional de Bolivia", code: "BOL-1", country: "Bolívia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/d/d4/Divisi%C3%B3n_Profesional_de_Bolivia_logo.svg" },
  { name: "Liga FUTVE", code: "VEN-1", country: "Venezuela", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/3/30/Liga_FUTVE_logo.svg" },

  // ==========================================
  // 15. MÉXICO
  // ==========================================
  { name: "Liga MX", code: "MEX-1", country: "México", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Liga_BBVA_MX_logo.svg" },
  { name: "Copa MX", code: "MEX-CUP", country: "México", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/b/b3/Copa_MX_logo.svg" },
  { name: "Campeón de Campeones", code: "MEX-CDC", country: "México", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Liga_BBVA_MX_logo.svg" },

  // ==========================================
  // 16. ARÁBIA SAUDITA & ORIENTE MÉDIO
  // ==========================================
  { name: "Saudi Pro League (Roshn)", code: "SAU-1", country: "Arábia Saudita", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/9/9c/Saudi_Pro_League_logo.svg" },
  { name: "King Cup (Copa do Rei Saudita)", code: "SAU-KC", country: "Arábia Saudita", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/7/73/King_Cup_logo.svg" },
  { name: "Saudi Super Cup", code: "SAU-SC", country: "Arábia Saudita", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/9/9c/Saudi_Pro_League_logo.svg" },
  { name: "Qatar Stars League", code: "QAT-1", country: "Catar", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/5/52/Qatar_Stars_League_logo.svg" },
  { name: "UAE Pro League", code: "UAE-1", country: "Emirados Árabes", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/8/87/UAE_Pro_League_logo.svg" },

  // ==========================================
  // 17. ÁSIA & OCEANIA
  // ==========================================
  { name: "J1 League", code: "JPN-1", country: "Japão", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/8/87/J1_League_logo.svg" },
  { name: "Emperor's Cup", code: "JPN-EC", country: "Japão", type: "CUP", logoUrl: "https://upload.wikimedia.org/wikipedia/en/8/87/J1_League_logo.svg" },
  { name: "K League 1", code: "KOR-1", country: "Coreia do Sul", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/K_League_1_logo.svg" },
  { name: "Chinese Super League", code: "CHN-1", country: "China", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/2/23/Chinese_Super_League_logo.svg" },
  { name: "A-League Men", code: "AUS-1", country: "Austrália", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/fa/A-League_Men_logo.svg" },

  // ==========================================
  // 18. DEMAIS LIGAS EUROPEIAS
  // ==========================================
  { name: "Austrian Bundesliga", code: "AUT-1", country: "Áustria", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/f6/Austrian_Football_Bundesliga_logo.svg" },
  { name: "Swiss Super League", code: "SUI-1", country: "Suíça", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b6/Swiss_Super_League_logo.svg" },
  { name: "Ukrainian Premier League", code: "UKR-1", country: "Ucrânia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b4/Ukrainian_Premier_League_logo.svg" },
  { name: "Danish Superliga", code: "DEN-1", country: "Dinamarca", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/e/e9/Danish_Superliga_logo.svg" },
  { name: "Allsvenskan", code: "SWE-1", country: "Suécia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/6/63/Allsvenskan_logo.svg" },
  { name: "Eliteserien", code: "NOR-1", country: "Noruega", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b1/Eliteserien_logo.svg" },
  { name: "SuperSport HNL", code: "CRO-1", country: "Croácia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/fc/SuperSport_HNL_logo.svg" },
  { name: "Ekstraklasa", code: "POL-1", country: "Polônia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/6/6f/Ekstraklasa_logo.svg" },
  { name: "Serbian SuperLiga", code: "SRB-1", country: "Sérvia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/b/b5/Serbian_SuperLiga_logo.svg" },
  { name: "Chance Liga (República Tcheca)", code: "CZE-1", country: "República Tcheca", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/Czech_First_League_logo.svg" },

  // ==========================================
  // 19. ÁFRICA
  // ==========================================
  { name: "Botola Pro", code: "MAR-1", country: "Marrocos", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/4/41/Botola_logo.svg" },
  { name: "Egyptian Premier League", code: "EGY-1", country: "Egito", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/e/eb/Egyptian_Premier_League_logo.svg" },
  { name: "Betway Premiership", code: "RSA-1", country: "África do Sul", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/c/c2/South_African_Premier_Division_logo.svg" },
  { name: "Ligue Professionnelle 1", code: "TUN-1", country: "Tunísia", type: "LEAGUE", logoUrl: "https://upload.wikimedia.org/wikipedia/en/4/41/Botola_logo.svg" },

  // ==========================================
  // 20. COMPETIÇÕES INTERNACIONAIS DE CLUBES
  // ==========================================
  { name: "UEFA Champions League", code: "UCL", country: "Europa", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/f/f3/UEFA_Champions_League_logo_2.svg" },
  { name: "UEFA Europa League", code: "UEL", country: "Europa", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/6/6b/UEFA_Europa_League_logo_%282021%29.svg" },
  { name: "UEFA Conference League", code: "UECL", country: "Europa", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/ec/UEFA_Europa_Conference_League_logo.svg" },
  { name: "UEFA Super Cup", code: "UEFA-SC", country: "Europa", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/5/5e/UEFA_Super_Cup_logo_2021.svg" },
  { name: "CONMEBOL Libertadores", code: "LIB", country: "América do Sul", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/c/c2/Copa_Libertadores_da_Am%C3%A9rica_logo.png" },
  { name: "CONMEBOL Sul-Americana", code: "SUL", country: "América do Sul", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/f/fb/Copa_Sul-Americana_logo.png" },
  { name: "Recopa Sul-Americana", code: "REC", country: "América do Sul", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/b/b8/Recopa_Sul-Americana_logo.png" },
  { name: "AFC Champions League Elite", code: "AFC-ACL", country: "Ásia", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/5/52/AFC_Champions_League_Elite_logo.svg" },
  { name: "CAF Champions League", code: "CAF-CCL", country: "África", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/f7/CAF_Champions_League_logo.svg" },
  { name: "CONCACAF Champions Cup", code: "CONC-CC", country: "América do Norte", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/f/f7/CONCACAF_Champions_Cup_logo.svg" },
  { name: "Copa do Mundo de Clubes da FIFA", code: "FCWC", country: "Mundial", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/FIFA_Club_World_Cup_logo.svg" },
  { name: "Copa Intercontinental da FIFA", code: "FIFA-IC", country: "Mundial", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/8/87/FIFA_Club_World_Cup_logo.svg" },

  // ==========================================
  // 21. COMPETIÇÕES DE SELEÇÕES
  // ==========================================
  { name: "Copa do Mundo FIFA", code: "WC-2026", country: "Mundial", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/FIFA_World_Cup_2026_Emblem.svg" },
  { name: "Copa América", code: "CA", country: "América do Sul", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/pt/2/25/Copa_Am%C3%A9rica_logo.png" },
  { name: "UEFA Eurocopa", code: "EURO", country: "Europa", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/1/15/UEFA_Euro_2024_Logo.svg" },
  { name: "Eliminatórias da Copa - CONMEBOL", code: "WCQ-CONMEBOL", country: "América do Sul", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/FIFA_World_Cup_2026_Emblem.svg" },
  { name: "Eliminatórias da Copa - UEFA", code: "WCQ-UEFA", country: "Europa", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/commons/e/e0/FIFA_World_Cup_2026_Emblem.svg" },
  { name: "UEFA Nations League", code: "UEFA-NL", country: "Europa", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/6/6b/UEFA_Nations_League_logo.svg" },
  { name: "Copa Africana de Nações (AFCON)", code: "AFCON", country: "África", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/a/a2/Africa_Cup_of_Nations_logo.svg" },
  { name: "Copa da Ásia (AFC Asian Cup)", code: "AFC-AC", country: "Ásia", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/d7/2023_AFC_Asian_Cup_logo.svg" },
  { name: "Copa Ouro da CONCACAF", code: "CONC-GC", country: "América do Norte", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/d/d0/CONCACAF_Gold_Cup_logo.svg" },
  { name: "Copa do Mundo Feminina FIFA", code: "WC-FEM", country: "Mundial", type: "INTERNATIONAL", logoUrl: "https://upload.wikimedia.org/wikipedia/en/e/e0/FIFA_Women%27s_World_Cup_logo.svg" },
];

async function run() {
  console.log(`🌍 Cadastrando todos os campeonatos e ligas do mundo (${ALL_COMPETITIONS.length} competições)...`);
  
  let insertedCount = 0;
  let updatedCount = 0;
  let seasonsCreated = 0;

  for (const comp of ALL_COMPETITIONS) {
    let [existing] = await db.select().from(competitions).where(eq(competitions.code, comp.code));

    if (existing) {
      await db.update(competitions).set({
        name: comp.name,
        country: comp.country,
        type: comp.type,
        logoUrl: comp.logoUrl || existing.logoUrl,
        updatedAt: new Date(),
      }).where(eq(competitions.id, existing.id));
      updatedCount++;
    } else {
      const [newComp] = await db.insert(competitions).values({
        name: comp.name,
        code: comp.code,
        country: comp.country,
        type: comp.type,
        logoUrl: comp.logoUrl,
      }).returning();
      existing = newComp;
      insertedCount++;
    }

    // Garantir temporada 2026 cadastrada
    const seasonName = comp.seasonName || "2026";
    const existingSeason = await db.query.seasons.findFirst({
      where: (s, { and, eq }) => and(eq(s.competitionId, existing.id), eq(s.name, seasonName)),
    });

    if (!existingSeason) {
      await db.insert(seasons).values({
        competitionId: existing.id,
        name: seasonName,
        startDate: comp.startDate || "2026-01-01",
        endDate: comp.endDate || "2026-12-31",
        isCurrent: true,
      });
      seasonsCreated++;
    }
  }

  console.log(`✅ Sucesso!`);
  console.log(`   - Novas competições criadas: ${insertedCount}`);
  console.log(`   - Competições atualizadas: ${updatedCount}`);
  console.log(`   - Temporadas 2026 vinculadas: ${seasonsCreated}`);
  console.log(`   - Total geral de competições disponíveis: ${ALL_COMPETITIONS.length}`);

  await client.end();
}

run().catch((err) => {
  console.error("❌ Erro ao cadastrar competições:", err);
  process.exit(1);
});
