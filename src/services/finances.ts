/**
 * BrasaFut API - Club Finances & Financial Fair Play Engine
 * Motor econômico de estimativa de folha salarial, orçamento e conformidade com o Fair Play Financeiro
 */

export interface TeamFinancialProfile {
  teamId: number;
  teamName: string;
  shortName: string;
  monthlyPayrollMillionsBrl: number;
  annualBudgetMillionsBrl: number;
  salaryCapMillionsBrl: number;
  averagePlayerSalaryThousandsBrl: number;
  rosterSize: number;
  pointsSeason: number;
  costPerPointThousandsBrl: number; // Folha mensal / pontos
  financialFairPlayStatus: "HEALTHY" | "MODERATE" | "RISK_DEFICIT";
  complianceScorePct: number; // 0 a 100% de conformidade com os limites de gastos da CBF/FIFA
  insights: string;
}

export class FinancesService {
  /**
   * Obtém o perfil financeiro de um clube
   */
  public static getTeamFinances(team: {
    id: number;
    name: string;
    shortName?: string | null;
  }, points: number = 45): TeamFinancialProfile {
    const norm = (team.name + " " + (team.shortName || "")).toUpperCase();

    let monthlyPayroll = 14.5;
    let annualBudget = 180;
    let salaryCap = 1.8;
    let status: "HEALTHY" | "MODERATE" | "RISK_DEFICIT" = "HEALTHY";
    let complianceScore = 88;
    let insights = "Estrutura financeira sustentável e equilibrada com as receitas operacionais.";

    if (norm.includes("FLAMENGO")) {
      monthlyPayroll = 38.5;
      annualBudget = 1100;
      salaryCap = 2.5;
      status = "HEALTHY";
      complianceScore = 95;
      insights = "Maior faturamento do continente, superávit contínuo e relação folha/receita abaixo de 50%.";
    } else if (norm.includes("PALMEIRAS")) {
      monthlyPayroll = 34.0;
      annualBudget = 950;
      salaryCap = 2.4;
      status = "HEALTHY";
      complianceScore = 94;
      insights = "Modelo financeiro exemplar, forte receita de patrocinador e base exportadora sólida.";
    } else if (norm.includes("SÃO PAULO") || norm.includes("SAO PAULO")) {
      monthlyPayroll = 22.0;
      annualBudget = 580;
      salaryCap = 1.6;
      status = "MODERATE";
      complianceScore = 78;
      insights = "Folha controlada após recente renegociação de dívidas tributárias e bancárias.";
    } else if (norm.includes("CORINTHIANS")) {
      monthlyPayroll = 25.5;
      annualBudget = 620;
      salaryCap = 2.0;
      status = "RISK_DEFICIT";
      complianceScore = 62;
      insights = "Alerta do Fair Play: passivo elevado e alto índice de comprometimento das receitas com folha.";
    } else if (norm.includes("BOTAFOGO")) {
      monthlyPayroll = 26.0;
      annualBudget = 680;
      salaryCap = 2.2;
      status = "HEALTHY";
      complianceScore = 85;
      insights = "SAF com grande aporte de capital internacional e valorização de ativos em campo.";
    } else if (norm.includes("ATLÉTICO") || norm.includes("ATLETICO")) {
      monthlyPayroll = 24.5;
      annualBudget = 600;
      salaryCap = 1.9;
      status = "MODERATE";
      complianceScore = 74;
      insights = "Equacionamento de dívidas através da SAF e arena própria em fase de maturação.";
    } else {
      // Cálculo proporcional baseado no id
      monthlyPayroll = Number((8 + ((team.id * 7) % 15)).toFixed(1));
      annualBudget = Math.round(monthlyPayroll * 14.5);
      salaryCap = Number((0.6 + ((team.id * 3) % 10) / 10).toFixed(1));
      complianceScore = 70 + (team.id % 25);
      status = complianceScore >= 80 ? "HEALTHY" : complianceScore >= 68 ? "MODERATE" : "RISK_DEFICIT";
      insights = "Operação dentro do planejamento orçamentário anual da diretoria.";
    }

    const rosterSize = 32;
    const avgSalary = Math.round((monthlyPayroll * 1000) / rosterSize);
    const costPerPoint = points > 0 ? Math.round((monthlyPayroll * 1000) / points) : 400;

    return {
      teamId: team.id,
      teamName: team.name,
      shortName: team.shortName || team.name,
      monthlyPayrollMillionsBrl: monthlyPayroll,
      annualBudgetMillionsBrl: annualBudget,
      salaryCapMillionsBrl: salaryCap,
      averagePlayerSalaryThousandsBrl: avgSalary,
      rosterSize,
      pointsSeason: points,
      costPerPointThousandsBrl: costPerPoint,
      financialFairPlayStatus: status,
      complianceScorePct: complianceScore,
      insights,
    };
  }

  /**
   * Retorna o ranking de eficiência e folhas salariais de clubes
   */
  public static getFinancesRanking(teamsList: Array<{ id: number; name: string; shortName?: string | null; points?: number }>) {
    const list = teamsList.map((t) => this.getTeamFinances(t, t.points || 40));
    
    // Ordenar por folha salarial decrescente
    const byPayroll = [...list].sort((a, b) => b.monthlyPayrollMillionsBrl - a.monthlyPayrollMillionsBrl);
    
    // Ordenar por eficiência (menor custo por ponto conquistado)
    const byEfficiency = [...list].sort((a, b) => a.costPerPointThousandsBrl - b.costPerPointThousandsBrl);

    return {
      rankingByPayroll: byPayroll,
      rankingByEfficiency: byEfficiency,
    };
  }
}
