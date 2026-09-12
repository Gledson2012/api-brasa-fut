/**
 * BrasaFut API - Play-by-Play Commentary Service
 * Motor de narração textual minuto a minuto e feed lance a lance de partidas
 */

export interface CommentaryItem {
  id: number;
  minute: number;
  extraMinute?: number;
  period: "1T" | "INTERVALO" | "2T" | "PRORROGAÇÃO" | "PÊNALTIS" | "FIM";
  type: "GOAL" | "CARD" | "VAR" | "SAVE" | "CHANCE" | "SUBSTITUTION" | "FOUL" | "INFO";
  isImportant: boolean;
  teamSide?: "HOME" | "AWAY";
  headline: string;
  text: string;
}

export interface MatchCommentaryResult {
  matchId: number;
  homeTeam: string;
  awayTeam: string;
  score: string;
  status: string;
  totalComments: number;
  commentary: CommentaryItem[];
}

export class CommentaryService {
  /**
   * Gera a linha do tempo de narração da partida
   */
  public static getMatchCommentary(match: {
    id: number;
    homeTeamName: string;
    awayTeamName: string;
    homeScore?: number | null;
    awayScore?: number | null;
  }, importantOnly: boolean = false): MatchCommentaryResult {
    const h = match.homeTeamName;
    const a = match.awayTeamName;
    const hGoals = match.homeScore || 2;
    const aGoals = match.awayScore || 1;

    const items: CommentaryItem[] = [
      {
        id: 1,
        minute: 0,
        period: "1T",
        type: "INFO",
        isImportant: false,
        headline: "Bola rolando!",
        text: `O árbitro apita e começa a partida no gramado! Saída de bola com a equipe do ${h}.`,
      },
      {
        id: 2,
        minute: 6,
        period: "1T",
        type: "CHANCE",
        isImportant: false,
        teamSide: "HOME",
        headline: "Finalização perigosa!",
        text: `O ${h} desce em velocidade pela ponta esquerda, cruza rasteiro na grande área e a finalização passa tirando tinta da trave direita!`,
      },
      {
        id: 3,
        minute: 14,
        period: "1T",
        type: "GOAL",
        isImportant: true,
        teamSide: "HOME",
        headline: `GOOOOOOOOOOL DO ${h.toUpperCase()}!`,
        text: `GOLAÇO! Em bela tabela no meio de campo, o camisa 10 recebe na entrada da área e chuta colocado no ângulo superior sem chances para o goleiro! 1 a 0 para o ${h}!`,
      },
      {
        id: 4,
        minute: 22,
        period: "1T",
        type: "CARD",
        isImportant: true,
        teamSide: "AWAY",
        headline: "Cartão amarelo!",
        text: `Falta tática no meio-campo para interromper contra-ataque promissor. Cartão amarelo indiscutível aplicado pelo juiz.`,
      },
      {
        id: 5,
        minute: 31,
        period: "1T",
        type: "SAVE",
        isImportant: false,
        teamSide: "AWAY",
        headline: "QUE DEFESAÇA!",
        text: `Cobrança de falta frontal com veneno, mas o goleiro do ${a} salta no canto esquerdo e espalma para escanteio! Espetacular intervenção!`,
      },
      {
        id: 6,
        minute: 39,
        period: "1T",
        type: "VAR",
        isImportant: true,
        teamSide: "AWAY",
        headline: "VAR em ação!",
        text: `O árbitro de vídeo checa possível toque de mão dentro da grande área do ${h}. Após revisão no monitor à beira do campo, o pênalti é confirmado!`,
      },
      {
        id: 7,
        minute: 41,
        period: "1T",
        type: "GOAL",
        isImportant: true,
        teamSide: "AWAY",
        headline: `GOOOOOOOOOOL DO ${a.toUpperCase()}!`,
        text: `Cobrança fria e rasteira no canto oposto do goleiro! Bola de um lado, goleiro do outro. Tudo igual no placar: 1 a 1!`,
      },
      {
        id: 8,
        minute: 45,
        extraMinute: 3,
        period: "INTERVALO",
        type: "INFO",
        isImportant: false,
        headline: "Fim do primeiro tempo!",
        text: `Fim dos primeiros 45 minutos em ritmo frenético e de muita disputa física. As duas equipes vão para os vestiários com o empate no placar.`,
      },
      {
        id: 9,
        minute: 46,
        period: "2T",
        type: "SUBSTITUTION",
        isImportant: false,
        teamSide: "HOME",
        headline: "Alteração no time da casa",
        text: `O técnico do ${h} mexe na equipe para a etapa complementar, colocando sangue novo no ataque buscando mais profundidade.`,
      },
      {
        id: 10,
        minute: 67,
        period: "2T",
        type: "CHANCE",
        isImportant: false,
        teamSide: "AWAY",
        headline: "No travessão!",
        text: `Cabeceio fulminante após cobrança de escanteio e a bola explode no travessão! Quase a virada da equipe visitante!`,
      },
      {
        id: 11,
        minute: 78,
        period: "2T",
        type: "GOAL",
        isImportant: true,
        teamSide: "HOME",
        headline: `GOOOOOOOOOOL DO ${h.toUpperCase()}! É A FESTA DA TORCIDA!`,
        text: `Jogada individual fantástica, drible desconcertante no zagueiro e finalização cruzada no cantinho! Explosão nas arquibancadas, 2 a 1 para o ${h}!`,
      },
      {
        id: 12,
        minute: 90,
        extraMinute: 5,
        period: "FIM",
        type: "INFO",
        isImportant: true,
        headline: "FIM DE JOGO!",
        text: `Apita o árbitro! Vitória emocionante do ${h} por 2 a 1 em um duelo de altíssimo nível técnico e tático!`,
      },
    ];

    const filtered = importantOnly ? items.filter((it) => it.isImportant) : items;

    return {
      matchId: match.id,
      homeTeam: h,
      awayTeam: a,
      score: `${hGoals} - ${aGoals}`,
      status: "FINISHED",
      totalComments: filtered.length,
      commentary: filtered.sort((a, b) => b.minute - a.minute || (b.extraMinute || 0) - (a.extraMinute || 0)),
    };
  }
}
