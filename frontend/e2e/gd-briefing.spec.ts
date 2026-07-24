import { test, expect, type Page } from '@playwright/test';
import { E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD } from './credentials';

// Testa o preenchimento do briefing a partir da transcrição.
//
// O endpoint de IA é interceptado, então o teste é determinístico e NÃO precisa
// da GROQ_API_KEY. O que se verifica aqui é o contrato entre a resposta da IA e
// a tela: campo certo recebe valor certo, subcampos do público são preenchidos,
// nome de quem falou não aparece e campo sem informação continua pendente.

const ROTA_IA = '**/api/geracao-digital/briefing/extract';

const RESPOSTA_IA = {
  success: true,
  data: {
    concorrentes: 'Alfa Contabilidade e Beta Contadores',
    servicos: 'Escritório de contabilidade para pequenas empresas',
    localizacao: 'Curitiba e região metropolitana',
    ticket_margem: 'Ticket médio de R$ 800 com margem de 40%',
    diferencial: 'Atendimento consultivo e contabilidade digital',
    site: '',
    dominios_dns: '',
    inspiracao: '',
    'publico_alvo.genero': 'Predominantemente mulheres',
    'publico_alvo.idade': '30 a 50 anos',
    'publico_alvo.classe': 'Classe B',
    'publico_alvo.interesses': 'Empreendedorismo e gestão financeira',
    'publico_alvo.outros_detalhes': '',
  } as Record<string, string>,
};

async function login(page: Page) {
  await page.goto('/login');
  await page.fill('input[type="email"]', E2E_ADMIN_EMAIL);
  await page.fill('input[type="password"]', E2E_ADMIN_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/.*dashboard.*/, { timeout: 15000 });
}

/** Abre a apresentação e navega até o slide do briefing. */
async function abrirBriefing(page: Page) {
  await page.goto('/crm/geracao-digital');
  await page.getByRole('button', { name: /Iniciar Apresentação/i }).click();

  const proximo = page.getByRole('button', { name: /Próximo Slide/i });
  const transcricao = page.getByPlaceholder(/O cliente disse que o orçamento/i);

  for (let i = 0; i < 6; i++) {
    if (await transcricao.isVisible().catch(() => false)) break;
    await proximo.click();
    await page.waitForTimeout(300);
  }
  await expect(transcricao).toBeVisible({ timeout: 10000 });
  return transcricao;
}

/** Valor atual de um campo do briefing, achado pelo rótulo. */
async function valorDoCampo(page: Page, rotulo: string): Promise<string> {
  const campo = page
    .locator(`text=${rotulo}`)
    .first()
    .locator('xpath=ancestor::div[1]')
    .locator('input, textarea')
    .first();
  return (await campo.inputValue().catch(() => '')) || '';
}

test.describe('Briefing GD: preenchimento pela transcrição', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('preenche os campos com o que a IA devolveu, inclusive os subcampos do público', async ({ page }) => {
    await page.route(ROTA_IA, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESPOSTA_IA) })
    );

    const transcricao = await abrirBriefing(page);
    await transcricao.fill(
      'Comercial Geração Digital: Quem são os concorrentes?\nGilvane Borba: Alfa Contabilidade e Beta Contadores.'
    );
    await page.getByRole('button', { name: /Gerar Automação do Briefing/i }).click();

    // O preenchimento é animado passo a passo; espera o último campo chegar.
    await expect(page.locator('text=Alfa Contabilidade').first()).toBeVisible({ timeout: 45000 });

    expect(await valorDoCampo(page, 'Gênero')).toContain('mulheres');
    expect(await valorDoCampo(page, 'Faixa etária')).toContain('30 a 50');
    expect(await valorDoCampo(page, 'Classe social')).toContain('Classe B');
    expect(await valorDoCampo(page, 'Ticket médio e margem')).toContain('800');
  });

  test('nenhum campo traz o nome de quem falou nem a pergunta', async ({ page }) => {
    await page.route(ROTA_IA, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESPOSTA_IA) })
    );

    const transcricao = await abrirBriefing(page);
    await transcricao.fill('Comercial Geração Digital: Quem são os concorrentes?\nGilvane Borba: Alfa e Beta.');
    await page.getByRole('button', { name: /Gerar Automação do Briefing/i }).click();
    await expect(page.locator('text=Alfa Contabilidade').first()).toBeVisible({ timeout: 45000 });

    const valores = await page.locator('input, textarea').evaluateAll((els) =>
      els.map((el) => (el as HTMLInputElement | HTMLTextAreaElement).value || '')
    );
    const preenchidos = valores.filter((v) => v && v.length > 3);
    expect(preenchidos.length).toBeGreaterThan(0);

    for (const v of preenchidos) {
      const t = v.toLowerCase();
      expect(t.includes('gilvane'), `campo trouxe o falante: ${v}`).toBe(false);
      expect(t.includes('comercial geração digital'), `campo trouxe o falante: ${v}`).toBe(false);
      expect(v.trim().endsWith('?'), `campo recebeu pergunta: ${v}`).toBe(false);
    }
  });

  test('campo sem informação na transcrição fica pendente, sem texto genérico', async ({ page }) => {
    await page.route(ROTA_IA, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(RESPOSTA_IA) })
    );

    const transcricao = await abrirBriefing(page);
    await transcricao.fill('Comercial Geração Digital: Quem são os concorrentes?\nGilvane Borba: Alfa e Beta.');
    await page.getByRole('button', { name: /Gerar Automação do Briefing/i }).click();
    await expect(page.locator('text=Alfa Contabilidade').first()).toBeVisible({ timeout: 45000 });

    // "Site" veio vazio da IA: não pode receber o antigo texto de preenchimento.
    await expect(
      page.locator('text=Preenchido com base nas respostas do briefing comercial.')
    ).toHaveCount(0);
  });

  test('avisa o operador quando a IA está indisponível', async ({ page }) => {
    await page.route(ROTA_IA, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'IA indisponível: GROQ_API_KEY não configurada no servidor.' }),
      })
    );

    const transcricao = await abrirBriefing(page);
    await transcricao.fill('Comercial Geração Digital: Quem são os concorrentes?\nGilvane Borba: Alfa e Beta.');
    await page.getByRole('button', { name: /Gerar Automação do Briefing/i }).click();

    await expect(page.locator('text=/IA indispon[íi]vel/i').first()).toBeVisible({ timeout: 15000 });
  });
});
