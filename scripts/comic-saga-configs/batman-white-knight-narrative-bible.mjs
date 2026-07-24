import base from "./batman-white-knight-issues-01-08.mjs";

const details = [
  {
    id: "batman-crosses-line",
    title: "Batman perde o controle",
    narration: "Batman persegue o Coringa por Gotham e transforma a captura em espancamento. Diante de policiais e testemunhas, ele cruza um limite e enfia comprimidos na boca do inimigo. A violÃªncia que deveria encerrar o caos passa a colocar o prÃ³prio Batman em julgamento.",
    actors: ["Batman", "Coringa"], action: "Batman agride o Coringa e o forca a engolir comprimidos", motivation: "Batman quer encerrar definitivamente a ameaca do Coringa",
    terms: [["Batman"], ["Coringa"], ["comprimidos", "remedios"], ["forca", "enfia"]], targets: ["batman_joker_chase", "forced_pills", "police_witnesses"],
    visualCues: [{ text: "Batman persegue e agride o Coringa diante de Gotham", pages: [4, 5, 6, 7, 8, 9], focusTarget: "batman_joker_chase", verifiedFocusTargets: ["Batman", "Coringa", "Gotham"], evidenceTerms: ["Batman", "Coringa", "Gotham"], evidenceConfidence: 0.9, evidenceSource: "editorial_audit" }, { text: "Batman for?a os comprimidos na boca do Coringa", pages: [10], focusTarget: "forced_pills", verifiedFocusTargets: ["Batman", "Coringa", "comprimidos"], evidenceTerms: ["Batman", "Coringa", "comprimidos"], evidenceConfidence: 0.88, evidenceSource: "editorial_audit" }],
  },
  {
    id: "joker-becomes-jack",
    title: "Os rem?dios revelam Jack Napier",
    narration: "Os comprimidos provocam algo inesperado: o Coringa recupera a lucidez e se apresenta como Jack Napier. Consciente do mal que causou, ele aceita continuar medicado porque quer provar que pode ser alguÃ©m melhor, reparar seus crimes e enfrentar Batman sem voltar ao terrorismo. Mas a lucidez dependia dos remÃ©dios: se o efeito acabasse, o Coringa voltaria?",
    actors: ["Jack Napier", "Coringa"], action: "A medicacao restaura a lucidez de Jack", motivation: "Jack quer permanecer lucido e reparar o passado",
    terms: [["comprimidos", "medicacao"], ["lucidez", "lucido"], ["Jack Napier"], ["melhor", "reparar"]], targets: ["medicine", "joker_jack_transformation", "lucid_jack"],
    visualCues: [{ text: "Os comprimidos deixam o Coringa l?cido como Jack Napier", pages: [10, 11, 12, 13, 14], focusTarget: "joker_jack_transformation", verifiedFocusTargets: ["Coringa", "Jack Napier", "comprimidos"], evidenceTerms: ["Coringa", "Jack Napier", "comprimidos", "lucidez"], evidenceConfidence: 0.86, evidenceSource: "editorial_audit" }, { text: "Jack assume publicamente a nova identidade", pages: [15, 16], focusTarget: "lucid_jack", verifiedFocusTargets: ["Jack Napier"], evidenceTerms: ["Jack Napier", "Jack", "Gotham"], evidenceConfidence: 0.84, evidenceSource: "editorial_audit" }],
  },
  {
    id: "jack-puts-batman-on-trial",
    title: "Jack transforma os danos de Batman em acusa??o",
    narration: "Jack entende que nÃ£o precisa derrotar Batman numa luta. Ele mostra a Gotham os prÃ©dios destruÃ­dos, os feridos e o dinheiro gasto para consertar cada batalha. Sua pergunta Ã© simples e perigosa: se Batman protege a cidade, por que as pessoas comuns continuam pagando a conta?",
    actors: ["Jack Napier", "Batman", "Gotham"], action: "Jack acusa publicamente Batman pelos danos colaterais", motivation: "Jack quer conquistar legitimidade e responsabilizar Batman",
    terms: [["Jack"], ["Batman"], ["destruidos", "feridos", "danos"], ["pagando", "conta"]], targets: ["jack_public_speech", "batman_damage", "gotham_citizens"],
    visualCues: [{ text: "Jack apresenta sua acusa??o contra Batman", pages: [15, 16, 17, 18], focusTarget: "jack_public_speech", verifiedFocusTargets: ["Jack Napier", "Batman"], evidenceTerms: ["Jack", "Batman", "Gotham"], evidenceConfidence: 0.84, evidenceSource: "editorial_audit" }, { text: "Gotham encara pr?dios destru?dos e o custo das batalhas", pages: [23, 24], focusTarget: "batman_damage", verifiedFocusTargets: ["Gotham", "danos"], evidenceTerms: ["Gotham", "cidade", "danos", "destru?dos", "Batman"], evidenceConfidence: 0.9, evidenceSource: "editorial_audit" }],
  },
  {
    id: "jack-enters-politics",
    title: "O antigo vil?o entra na pol?tica",
    narration: "Com aparÃªncia controlada, argumentos claros e provas dos prejuÃ­zos, Jack entra em tribunais, entrevistas e na polÃ­tica de Gotham. O antigo palhaÃ§o agora parece razoÃ¡vel, enquanto Batman se recusa a prestar contas. A cidade comeÃ§a a enxergar Jack como alternativa e Batman como problema. Se Gotham acreditasse em Jack, Batman se tornaria o acusado?",
    actors: ["Jack Napier", "Batman"], action: "Jack usa a lei e a opiniao publica contra Batman", motivation: "Jack quer substituir o vigilantismo por controle publico",
    terms: [["Jack"], ["politica", "tribunais"], ["Batman"], ["alternativa", "problema"]], targets: ["jack_court", "jack_media", "public_reaction"],
    visualCues: [{ text: "Jack entra no debate p?blico e pol?tico", pages: [15, 16, 17, 18], issueNumber: 1, focusTarget: "jack_media", verifiedFocusTargets: ["Jack Napier", "Gotham"], evidenceTerms: ["Jack", "Gotham", "pol?tica"], evidenceConfidence: 0.84, evidenceSource: "editorial_audit" }, { text: "A cidade passa a comparar Jack e Batman", pages: [19, 20], issueNumber: 2, focusTarget: "public_reaction", verifiedFocusTargets: ["Jack Napier", "Batman", "Gotham"], evidenceTerms: ["Jack", "Batman", "Gotham"], evidenceConfidence: 0.82, evidenceSource: "editorial_audit" }],
  },
  {
    id: "harley-recognizes-jack",
    title: "Harley percebe que Jack ? real",
    narration: "Harley percebe que Jack nÃ£o Ã© apenas outra encenaÃ§Ã£o do Coringa. Ele demonstra culpa, afeto e vontade de corrigir o passado. Mas a esperanÃ§a vem com um medo: a lucidez depende dos remÃ©dios, e a personalidade do Coringa continua escondida dentro dele, esperando uma recaÃ­da. O perigo era simples: por quanto tempo Jack ainda manteria o Coringa sob controle?",
    actors: ["Harley Quinn", "Jack Napier", "Coringa"], action: "Harley reconhece a humanidade de Jack e teme a recaida", motivation: "Harley quer preservar a pessoa que Jack tenta se tornar",
    terms: [["Harley"], ["Jack"], ["remedios", "lucidez"], ["Coringa", "recaida"]], targets: ["harley_jack", "medicine_dependency", "joker_shadow"],
    visualCues: [{ text: "Harley reconhece a humanidade de Jack", pages: [5, 6, 7, 8], issueNumber: 2, focusTarget: "harley_jack", verifiedFocusTargets: ["Harley Quinn", "Jack Napier"], evidenceTerms: ["Harley", "Jack", "Coringa"], evidenceConfidence: 0.88, evidenceSource: "editorial_audit" }, { text: "A sombra do Coringa amea?a voltar", pages: [14, 15, 16, 17, 18], issueNumber: 2, focusTarget: "joker_shadow", verifiedFocusTargets: ["Coringa", "Jack Napier", "Harley Quinn"], evidenceTerms: ["Coringa", "Jack", "Harley"], evidenceConfidence: 0.84, evidenceSource: "editorial_audit" }],
  },
  {
    id: "nightwing-breaks-with-batman",
    title: "A pr?pria fam?lia de Batman contesta seus m?todos",
    narration: "A crÃ­tica deixa de vir apenas dos criminosos. Asa Noturna, Barbara e o comissÃ¡rio Gordon enxergam que Bruce estÃ¡ mais violento, fechado e disposto a colocar todos em risco para manter o controle. Quando atÃ© seus aliados exigem limites, Batman percebe que pode perder a cidade e a prÃ³pria famÃ­lia.",
    actors: ["Asa Noturna", "Barbara Gordon", "Comissario Gordon", "Batman"], action: "Os aliados de Batman confrontam seus metodos", motivation: "Os aliados querem proteger Gotham sem obedecer cegamente a Bruce",
    terms: [["Asa Noturna"], ["Barbara", "Gordon"], ["Batman", "Bruce"], ["aliados", "familia"]], targets: ["nightwing_confronts_batman", "bat_family_conflict", "gordon_accountability"],
  },
  {
    id: "backport-fund-exposed",
    title: "Jack revela o negocio escondido atras da destruicao",
    narration: "Investigando os estragos, Jack revela o Fundo de Devastacao de Batman: areas pobres perdem valor depois das batalhas, investidores compram os terrenos e lucram com a reconstrucao. A cruzada de Bruce nao apenas destroi bairros; existe um sistema inteiro enriquecendo com o desastre.",
    actors: ["Jack Napier", "Gotham", "Batman"], action: "Jack expoe o mecanismo financeiro ligado aos danos de Batman", motivation: "Jack quer provar que o caos de Batman alimenta corrupcao",
    terms: [["Fundo", "Devastacao"], ["bairros", "terrenos"], ["investidores", "lucram"], ["Batman"]], targets: ["backport_fund_evidence", "damaged_neighborhood", "public_hearing"],
  },
  {
    id: "jack-controls-rogues",
    title: "Jack transforma os antigos viloes em ferramenta",
    narration: "Para demonstrar que pode controlar o crime, Jack usa tecnologia do Chapeleiro Louco combinada ao corpo do Cara-de-Barro. Particulas espalhadas entre os viloes permitem comandar o grupo inteiro. O plano funciona, mas coloca um exercito perigoso nas maos de uma mente ainda instavel.",
    actors: ["Jack Napier", "Chapeleiro Louco", "Cara-de-Barro", "viloes"], action: "Jack controla os viloes por uma rede ligada ao Cara-de-Barro", motivation: "Jack quer acabar com o crime e provar superioridade sobre Batman",
    terms: [["Chapeleiro", "Louco"], ["Cara-de-Barro"], ["controlar", "comandar"], ["viloes"]], targets: ["mad_hatter_device", "clayface_particles", "controlled_rogues"],
  },
  {
    id: "bruce-family-secrets",
    title: "O passado de Bruce cobra seu preco",
    narration: "Enquanto Jack avanca, Bruce enfrenta perdas e segredos que vinha evitando. A distancia de Dick e Barbara aumenta, e a morte de Alfred retira o homem que ainda conseguia frear seus impulsos. Sem esse apoio, Batman reage com mais dureza justamente quando Gotham exige que ele mude.",
    actors: ["Bruce Wayne", "Alfred", "Dick Grayson", "Barbara Gordon"], action: "Bruce perde apoio emocional e se isola", motivation: "Bruce tenta manter a missao apesar do luto e da ruptura familiar",
    terms: [["Alfred"], ["Dick", "Asa Noturna"], ["Barbara"], ["Bruce", "Batman"]], targets: ["alfred_loss", "bruce_grief", "bat_family_distance"],
  },
  {
    id: "gto-created",
    title: "Gotham cria uma policia com tecnologia de Batman",
    narration: "Jack propoe a Unidade de Repressao ao Terrorismo de Gotham, a GTO: policiais equipados com veiculos e tecnologia de Batman, mas submetidos a lei. A ideia oferece a Gotham protecao sem um vigilante acima de todos. Para Bruce, ela parece uma tentativa de roubar sua missao.",
    actors: ["Jack Napier", "GTO", "Batman"], action: "Jack cria uma unidade policial baseada na tecnologia de Batman", motivation: "Jack quer institucionalizar a protecao de Gotham",
    terms: [["GTO", "Unidade"], ["policiais", "policia"], ["tecnologia"], ["Batman"]], targets: ["gto_reveal", "bat_technology", "jack_proposal"],
  },
  {
    id: "nightwing-and-batgirl-join-gto",
    title: "Asa Noturna e Batgirl escolhem trabalhar com a cidade",
    narration: "Asa Noturna e Batgirl aderem a GTO porque querem salvar pessoas com coordenacao e responsabilidade, nao continuar seguindo ordens imprevisiveis de Bruce. A decisao nao e uma traicao repentina; e a consequencia de anos vendo Batman afastar quem tenta questiona-lo.",
    actors: ["Asa Noturna", "Batgirl", "GTO", "Batman"], action: "Os antigos parceiros de Batman entram para a GTO", motivation: "Dick e Barbara querem proteger Gotham com limites e cooperacao",
    terms: [["Asa Noturna"], ["Batgirl"], ["GTO"], ["Bruce", "Batman"]], targets: ["nightwing_gto", "batgirl_gto", "batman_reaction"],
  },
  {
    id: "jack-medicine-fails",
    title: "A cura de Jack comeca a falhar",
    narration: "A transformacao de Jack nunca foi permanente. Conforme o efeito dos remedios enfraquece, lembrancas, impulsos e a voz do Coringa retornam. Harley tenta mante-lo lucido, mas todo o projeto politico agora depende de uma pergunta assustadora: quanto tempo Jack ainda consegue permanecer no controle?",
    actors: ["Jack Napier", "Harley Quinn", "Coringa"], action: "A medicacao perde efeito e o Coringa comeca a retornar", motivation: "Jack e Harley tentam preservar sua lucidez",
    terms: [["remedios", "medicacao"], ["efeito", "enfraquece"], ["Coringa"], ["controle"]], targets: ["medicine_failing", "jack_joker_split", "harley_support"],
  },
  {
    id: "neo-joker-revealed",
    title: "A segunda Harley assume o nome de Neo Coringa",
    narration: "A mulher que Jack chamava de Harley nao era a companheira original. Marian Drews havia substituido Harleen durante os anos mais violentos do Coringa. Rejeitada pela nova vida de Jack, ela assume o nome de Neo Coringa e decide destruir tudo que poderia impedir o antigo palhaco de voltar.",
    actors: ["Marian Drews", "Neo Coringa", "Harleen Quinzel", "Jack Napier"], action: "Marian revela sua identidade e assume o papel de Neo Coringa", motivation: "Marian quer recuperar o Coringa que amava",
    terms: [["Marian"], ["Neo Coringa"], ["Harleen", "Harley original"], ["voltar", "recuperar"]], targets: ["neo_joker_identity", "two_harleys", "jack_rejection"],
  },
  {
    id: "rogue-control-stolen",
    title: "Neo Coringa toma o controle do exercito de Jack",
    narration: "Neo Coringa rouba o mecanismo que controlava os viloes e transforma a maior prova de Jack em sua pior arma. O exercito que deveria demonstrar ordem passa a atacar Gotham. Agora a cidade culpa Jack, Batman nao conhece o sistema e apenas quem criou o plano sabe como interrompe-lo.",
    actors: ["Neo Coringa", "Jack Napier", "viloes"], action: "Neo Coringa sequestra o controle dos viloes", motivation: "Neo Coringa quer destruir a ordem criada por Jack",
    terms: [["Neo Coringa"], ["controlava", "controle"], ["viloes", "exercito"], ["Jack"]], targets: ["control_device_stolen", "rogue_army", "gotham_attack"],
  },
  {
    id: "batman-needs-jack",
    title: "Batman precisa confiar no homem que era seu inimigo",
    narration: "Batman percebe que nao pode vencer apenas batendo nos criminosos. Jack conhece a rede, os viloes e a logica da Neo Coringa melhor que qualquer heroi. Para salvar Gotham, Bruce precisa proteger a lucidez de Jack e aceitar ajuda justamente do homem que passou anos tentando destruir.",
    actors: ["Batman", "Jack Napier", "Neo Coringa"], action: "Batman forma uma alianca com Jack", motivation: "Batman quer entender e interromper o plano da Neo Coringa",
    terms: [["Batman", "Bruce"], ["Jack"], ["alianca", "ajuda", "confiar"], ["Neo Coringa"]], targets: ["batman_jack_alliance", "shared_plan", "uneasy_trust"],
  },
  {
    id: "freeze-history-and-weapon",
    title: "A historia da familia Freeze revela uma arma sob Gotham",
    narration: "Senhor Frio revela que sua familia e os Wayne carregam um segredo antigo: uma gigantesca tecnologia de congelamento permanece escondida sob Gotham. Neo Coringa descobre como ativa-la. O conflito deixa de ser apenas politico; agora existe uma arma capaz de congelar e destruir a cidade inteira.",
    actors: ["Senhor Frio", "familia Wayne", "Neo Coringa"], action: "O passado revela a superarma de congelamento", motivation: "Neo Coringa quer usar a tecnologia para impor o caos",
    terms: [["Senhor Frio", "Freeze"], ["Wayne"], ["arma", "tecnologia"], ["congelar", "congelamento"]], targets: ["freeze_history", "superweapon", "gotham_below"],
  },
  {
    id: "gotham-becomes-war-zone",
    title: "A superarma transforma Gotham em campo de guerra",
    narration: "Quando Neo Coringa ativa a arma, bairros, tuneis e estruturas de Gotham comecam a congelar e ruir. A GTO, os aliados de Batman e os criminosos libertos lutam em frentes diferentes. A guerra nao surge do nada: ela e o resultado direto do exercito roubado e da tecnologia descoberta sob a cidade.",
    actors: ["Neo Coringa", "GTO", "Batman", "Gotham"], action: "A arma e o exercito mergulham Gotham numa guerra", motivation: "Todos tentam impedir a destruicao da cidade",
    terms: [["arma"], ["congelar", "congelamento"], ["GTO"], ["exercito", "criminosos"]], targets: ["freeze_weapon_active", "gotham_war", "gto_battle"],
  },
  {
    id: "jack-relapses",
    title: "Jack perde terreno para o Coringa",
    narration: "A pressao acelera a recaida. Jack ainda quer salvar Gotham, mas cada crise devolve gestos e impulsos do Coringa. O conflito principal agora acontece dentro dele: usar aquela parte perigosa pode ajudar a prever Neo Coringa, mas tambem pode apagar para sempre o homem que tentou mudar.",
    actors: ["Jack Napier", "Coringa", "Neo Coringa"], action: "Jack alterna entre lucidez e a personalidade do Coringa", motivation: "Jack quer salvar Gotham sem perder sua nova identidade",
    terms: [["Jack"], ["Coringa"], ["recaida", "lucidez"], ["salvar Gotham"]], targets: ["jack_relapse", "joker_return", "internal_conflict"],
  },
  {
    id: "final-plan-formed",
    title: "Inimigos e antigos aliados montam um unico plano",
    narration: "Com Gotham desmoronando, Batman, Jack, Harley, Gordon, Asa Noturna, Batgirl e a GTO finalmente compartilham informacoes. Cada grupo recebe uma funcao: conter os viloes, retirar civis, chegar a superarma e impedir Neo Coringa. A cooperacao nasce porque nenhum deles consegue salvar a cidade sozinho.",
    actors: ["Batman", "Jack Napier", "Harley Quinn", "GTO"], action: "Os grupos rivais formam um plano conjunto", motivation: "Todos precisam impedir a destruicao de Gotham",
    terms: [["Batman"], ["Jack"], ["Asa Noturna", "Batgirl", "GTO"], ["plano", "funcao"]], targets: ["alliance_briefing", "nightwing_batgirl", "rescue_plan"],
  },
  {
    id: "city-rescue",
    title: "A batalha final vira uma operacao de salvamento",
    narration: "Enquanto a GTO protege civis e enfrenta os viloes controlados, Batman abre caminho para Jack chegar ao centro do plano. A batalha nao e uma guerra aleatoria entre grupos: cada confronto serve para ganhar segundos, desativar uma parte da ameaca e impedir que Gotham seja soterrada pelo gelo.",
    actors: ["GTO", "Batman", "Jack Napier"], action: "A alianca executa o resgate em varias frentes", motivation: "Os aliados querem salvar civis e alcancar a superarma",
    terms: [["for\u00e7a policial", "GTO", "equipe de Gordon"], ["civis"], ["Batman"], ["arma final", "amea\u00e7a", "gelo", "superarma"]], targets: ["gto_rescue", "batman_path", "controlled_rogues_battle"],
  },
  {
    id: "jack-accepts-cost",
    title: "Jack aceita que talvez nao sobreviva como Jack",
    narration: "Jack entende o preco da vitoria. Para antecipar Neo Coringa e concluir o plano, ele precisa se aproximar da mente que tentou abandonar. Isso pode trazer o Coringa de volta e destruir sua identidade, mas recuar deixaria Gotham morrer. Pela primeira vez, ele escolhe a cidade acima de si mesmo.",
    actors: ["Jack Napier", "Coringa", "Gotham"], action: "Jack arrisca sua identidade para salvar Gotham", motivation: "Jack quer reparar o dano e proteger a cidade",
    terms: [["Jack"], ["Coringa"], ["identidade"], ["Gotham", "cidade"]], targets: ["jack_choice", "identity_cost", "gotham_in_danger"],
  },
  {
    id: "batman-and-jack-confront-neo",
    title: "Batman e Jack chegam juntos ao confronto decisivo",
    narration: "Batman e Jack alcancam Neo Coringa por caminhos diferentes: Bruce usa a forca para abrir passagem, enquanto Jack entende o que Marian realmente deseja. O confronto final funciona porque os dois combinam aquilo que antes os separava, a capacidade de agir e a capacidade de compreender o caos.",
    actors: ["Batman", "Jack Napier", "Neo Coringa"], action: "Batman e Jack enfrentam Neo Coringa juntos", motivation: "Eles querem encerrar a ameaca e salvar Gotham",
    terms: [["Batman"], ["Jack"], ["Neo Coringa", "Marian"], ["juntos", "combinam"]], targets: ["batman_jack_final", "neo_joker_confrontation", "joint_action"],
  },
  {
    id: "jack-sacrifices-his-future",
    title: "Jack sacrifica o futuro que tentou construir",
    narration: "Para impedir a destruicao, Jack entrega o que ainda restava de sua vida como Jack Napier. Sua escolha prova que a mudanca era real, mesmo que os remedios nunca tivessem apagado completamente o Coringa. Ele nao vence por ser puro; vence porque escolhe fazer o certo quando o custo se torna pessoal.",
    actors: ["Jack Napier", "Coringa"], action: "Jack sacrifica sua identidade e seu futuro", motivation: "Jack quer salvar Gotham e provar que sua mudanca era verdadeira",
    terms: [["Jack Napier", "Jack"], ["remedios"], ["Coringa"], ["escolhe", "sacrifica"]], targets: ["jack_sacrifice", "medicine_truth", "final_choice"],
  },
  {
    id: "batman-accepts-accountability",
    title: "Batman reconhece que nao pode ficar acima da lei",
    narration: "Depois da batalha, Bruce admite que Jack estava certo sobre uma coisa: proteger Gotham nao lhe dava o direito de agir sem limites. Ele revela sua identidade a Gordon, aceita responder pelos danos e permite que seus aliados construam outra forma de proteger a cidade. A vitoria muda Batman, nao apenas Gotham.",
    actors: ["Bruce Wayne", "Comissario Gordon", "Asa Noturna", "Batgirl"], action: "Bruce revela sua identidade e aceita as consequencias", motivation: "Bruce quer reparar a relacao com Gotham e seus aliados",
    terms: [["Bruce"], ["identidade"], ["Gordon"], ["limites", "responder"]], targets: ["bruce_unmasks", "gordon_truth", "accountability"],
  },
  {
    id: "gotham-redefines-heroes",
    title: "Gotham deixa de depender de simbolos absolutos",
    narration: "No fim, Jack nao era um heroi perfeito e Batman nao era um vilao simples. Um mostrou a cidade o custo do outro. Gotham sobrevive quando seus simbolos aceitam limites, cooperacao e responsabilidade. A historia termina provando que salvar pessoas importa mais do que preservar a lenda do Batman ou do Coringa.",
    actors: ["Gotham", "Batman", "Jack Napier"], action: "A cidade redefine o legado de Batman e Jack", motivation: "Gotham precisa seguir sem colocar individuos acima das pessoas",
    terms: [["Gotham"], ["Batman"], ["Jack"], ["limites", "responsabilidade"]], targets: ["gotham_aftermath", "bat_family_future", "jack_legacy"],
  },
];

const revise = (id, enhancement) => Object.assign(details.find((detail) => detail.id === id), enhancement);
const auditedCue = (text, issueNumber, pages, focusTarget, verifiedFocusTargets, evidenceTerms, evidenceConfidence) => ({
  text, issueNumber, pages, focusTarget, verifiedFocusTargets, evidenceTerms, evidenceConfidence, evidenceSource: "editorial_audit",
});

revise("backport-fund-exposed", {
  title: "Jack descobre quem lucra com a destrui\u00e7\u00e3o",
  narration: "Depois de recuperar a lucidez, Jack Napier, o antigo vil\u00e3o Coringa, descobre que as batalhas de Batman alimentavam um neg\u00f3cio escondido. Quando a guerra de Batman atingiu um bairro pobre, investidores compraram os terrenos baratos e lucraram com a reconstru\u00e7\u00e3o paga pela cidade. O Fundo de Devasta\u00e7\u00e3o n\u00e3o protegia Gotham. Quem estava enriquecendo com cada desastre?",
  issueNumber: 2, pages: [17, 18, 19, 20],
  actors: ["Jack Napier", "Gotham", "Batman"],
  action: "Jack exp\u00f5e o mecanismo financeiro ligado aos danos de Batman",
  motivation: "Jack quer provar que o caos de Batman alimenta corrup\u00e7\u00e3o",
  terms: [["Fundo", "Devasta\u00e7\u00e3o"], ["bairro", "terreno"], ["investidores", "lucravam"], ["Batman"]],
  targets: ["backport_fund_evidence", "damaged_neighborhood", "investor_profit"],
  visualCues: [
    auditedCue("Jack Napier se apresenta a Gotham depois de recuperar a lucidez", 2, [4], "jack_public_identity", ["Jack Napier", "Gotham"], ["Jack", "Napier", "Coringa", "lucidez", "Gotham"], 0.9),
    auditedCue("Bruce ouve como o fundo transforma danos em lucro", 2, [19], "backport_fund_evidence", ["Bruce Wayne", "Fundo de Devasta\u00e7\u00e3o"], ["Bruce", "Batman", "fundo", "devasta\u00e7\u00e3o"], 0.91),
    auditedCue("Os bairros destru\u00eddos perdem valor para os investidores", 2, [20], "damaged_neighborhood", ["bairro destru\u00eddo", "investidores", "Batman", "Fundo de Devasta\u00e7\u00e3o", "Gotham"], ["bairro", "investidores", "Batman", "Gotham", "cidade", "fundo", "devasta\u00e7\u00e3o", "lucro", "desastre"], 0.94),
  ],
});
revise("jack-controls-rogues", {
  title: "Jack transforma os vil\u00f5es em um ex\u00e9rcito",
  narration: "Mas Jack n\u00e3o queria vencer apenas no discurso. Usando a tecnologia de controle mental do Chapeleiro Louco e part\u00edculas do corpo do Cara-de-Barro, ele conectou os criminosos de Gotham a uma mesma ordem. De repente, os antigos inimigos de Batman obedeciam a Jack. Parecia a prova de que ele podia controlar o caos, mas tamb\u00e9m criava uma arma perigosa demais para cair nas m\u00e3os erradas.",
  issueNumber: 2, pages: [21, 22, 23],
  terms: [["Chapeleiro", "Louco"], ["Cara-de-Barro"], ["controle", "obedeciam"], ["vil\u00f5es", "criminosos"]],
  targets: ["rogues_meeting", "mad_hatter_device", "clayface_control"],
  visualCues: [
    auditedCue("Jack re\u00fane os criminosos de Gotham", 2, [21, 22], "rogues_meeting", ["Jack Napier", "vil\u00f5es", "criminosos"], ["Jack", "Napier", "Gotham", "vil\u00f5es", "criminosos", "Batman", "inimigos", "discurso"], 0.9),
    auditedCue("O Chapeleiro e o Cara-de-Barro viabilizam o controle", 2, [23], "clayface_control", ["Chapeleiro Louco", "Cara-de-Barro", "Jack Napier"], ["Chapeleiro", "Louco", "Cara-de-Barro", "controle", "tecnologia", "arma", "caos"], 0.92),
  ],
});
revise("bruce-family-secrets", {
  title: "O segredo de Bruce afasta sua fam\u00edlia",
  narration: "Enquanto Jack conquistava Gotham, a fam\u00edlia de Bruce come\u00e7ava a se desfazer. Diante do memorial de Alfred, Dick conta a Barbara um segredo antigo: Bruce nunca contou toda a verdade sobre Jason Todd, o Robin que desapareceu depois de enfrentar o Coringa. Se Batman escondesse a dor, quem ainda poderia salv\u00e1-lo?",
  issueNumber: 3, pages: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  terms: [["Alfred"], ["Dick", "Asa Noturna"], ["Barbara"], ["Jason", "Robin"]],
  targets: ["alfred_grave", "dick_barbara_confession", "jason_secret"],
  visualCues: [auditedCue("Jack conquista a aten\u00e7\u00e3o de Gotham", 3, [12], "jack_public_speech", ["Jack Napier", "Gotham"], ["Jack", "Napier", "Gotham", "cidade"], 0.9),
    auditedCue("Dick e Barbara conversam diante do t\u00famulo de Alfred e revelam o segredo de Jason", 3, [15], "alfred_grave", ["Dick Grayson", "Barbara Gordon", "t\u00famulo de Alfred", "Jason Todd", "Robin", "Bruce Wayne", "Coringa"], ["Dick", "Barbara", "Alfred", "Jason", "Robin", "Bruce", "Batman", "Coringa", "fam\u00edlia", "segredo"], 0.94)],
});
revise("nightwing-breaks-with-batman", {
  title: "Asa Noturna se recusa a seguir Batman",
  narration: "Para Dick, o problema j\u00e1 n\u00e3o era apenas o passado. Batman estava mais violento, fechado e disposto a decidir tudo sozinho. Asa Noturna avisa Barbara que n\u00e3o vai mais obedecer Bruce sem questionar. Se at\u00e9 o parceiro que cresceu ao lado dele foi embora, quem ainda conseguiria deter Batman?",
  issueNumber: 3, pages: [16, 17, 18, 19, 20, 21, 22, 23],
  terms: [["Asa Noturna", "Dick"], ["Barbara"], ["Batman", "Bruce"], ["fam\u00edlia", "parceiro"]],
  targets: ["nightwing_confronts_batman", "dick_barbara_conflict", "bat_family_break"],
  visualCues: [auditedCue("Dick explica a Barbara por que n\u00e3o seguir\u00e1 Bruce", 3, [16], "dick_barbara_conflict", ["Dick Grayson", "Barbara Gordon", "Batman", "Asa Noturna", "Bruce Wayne"], ["Dick", "Barbara", "Bruce", "Batman", "Asa Noturna", "parceiro", "fam\u00edlia"], 0.95)],
});
revise("gto-created", {
  title: "Jack oferece a Gordon uma nova forma de proteger Gotham",
  narration: "Com Asa Noturna longe de Batman, Jack oferece uma sa\u00edda ao comiss\u00e1rio Gordon: transformar o dinheiro do fundo numa unidade policial preparada para amea\u00e7as sobre-humanas. A cidade teria uma pol\u00edcia organizada, regras claras e acesso \u00e0 tecnologia escondida por Batman. Gordon acreditava que o plano devolveria o controle \u00e0 cidade. Mas Bruce aceitaria ver sua miss\u00e3o nas m\u00e3os da pol\u00edcia?",
  issueNumber: 4, pages: [4, 5, 6, 7, 8, 9, 10],
  terms: [["Gordon"], ["unidade", "policial"], ["tecnologia"], ["Batman", "Bruce"]],
  targets: ["jack_gordon_proposal", "police_reform", "bat_technology"],
  visualCues: [auditedCue("Jack apresenta a Gordon sua proposta para a pol\u00edcia", 4, [10], "jack_gordon_proposal", ["Jack Napier", "Comiss\u00e1rio Gordon", "pol\u00edcia", "Batman", "Asa Noturna"], ["Jack", "Napier", "Gordon", "pol\u00edcia", "Batman", "Bruce", "Asa Noturna", "fundo", "dinheiro", "unidade", "amea\u00e7as", "cidade", "controle"], 0.95)],
});
revise("nightwing-and-batgirl-join-gto", {
  title: "Jack tenta trazer os parceiros de Batman para a lei",
  narration: "O passo mais ousado de Jack era convidar Batgirl e Asa Noturna para legitimar a nova unidade. Ele prometia comunica\u00e7\u00e3o, c\u00e2meras, coordena\u00e7\u00e3o e responsabilidade p\u00fablica, tudo o que faltava nas ordens imprevis\u00edveis de Bruce. O plano ainda precisava ser aceito, mas a escolha agora estava diante deles: continuar seguindo Batman ou ajudar Gotham a construir algo que n\u00e3o dependesse de um \u00fanico homem.",
  issueNumber: 4, pages: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23],
  terms: [["Asa Noturna"], ["Batgirl"], ["GTO", "unidade"], ["Batman", "Bruce"]],
  targets: ["jack_recruits_batfamily", "gto_rules", "gto_public_plan"],
  visualCues: [
    auditedCue("Jack explica por que quer Batgirl e Asa Noturna na unidade", 4, [11, 12], "jack_recruits_batfamily", ["Jack Napier", "Batgirl", "Asa Noturna", "Bruce Wayne"], ["Jack", "Napier", "Batgirl", "Asa Noturna", "Batman", "Bruce", "unidade", "comunica\u00e7\u00e3o", "c\u00e2meras"], 0.94),
    auditedCue("O plano formal da nova unidade de Gotham", 4, [22], "gto_public_plan", ["GTO", "Comiss\u00e1rio Gordon", "tecnologia de Batman", "Gotham"], ["GTO", "Gordon", "tecnologia", "Batman", "Gotham", "cidade", "unidade"], 0.93),
  ],
});
revise("jack-medicine-fails", {
  title: "A lucidez de Jack come\u00e7a a falhar",
  narration: "Mas a vit\u00f3ria de Jack tinha prazo. Os rem\u00e9dios que mantinham l\u00facido o antigo vil\u00e3o conhecido como Coringa estavam perdendo o efeito. A doutora ainda enxergava o homem que tentava mudar, mas Marian enxergava apenas o palha\u00e7o preso atr\u00e1s daqueles olhos. Quanto tempo faltava at\u00e9 Jack desaparecer?",
  issueNumber: 4, pages: [17, 18, 19],
  terms: [["rem\u00e9dios", "p\u00edlulas"], ["efeito", "controle"], ["Coringa"], ["Jack"]],
  targets: ["jack_joker_split", "harleen_protects_jack", "medicine_failing"],
  visualCues: [
    auditedCue("Harleen tenta proteger Jack enquanto a lucidez dele falha", 4, [18], "harleen_protects_jack", ["Harleen", "Jack Napier"], ["Harleen", "Jack", "rem\u00e9dios", "lucidez", "Coringa"], 0.93),
    auditedCue("Marian afirma que o Coringa continua preso por tr\u00e1s dos olhos de Jack", 4, [19], "jack_joker_split", ["Marian Drews", "Jack Napier", "Coringa"], ["Marian", "Jack", "Coringa", "p\u00edlulas", "controle"], 0.95),
  ],
});
revise("neo-joker-revealed", {
  title: "A outra Harley se torna a Neo Coringa",
  narration: "Com a lucidez dele enfraquecendo, Marian Drews n\u00e3o queria salvar Jack. Ela tinha ocupado o lugar da parceira original nos anos mais violentos do Coringa e amava justamente aquela vers\u00e3o dele. Depois que Jack a abandona, ela assume o nome de Neo Coringa. E faz uma promessa simples: ela queria trazer o antigo Coringa de volta.",
  issueNumber: 4, pages: [19, 20, 21],
  terms: [["Marian"], ["Neo Coringa"], ["parceira", "original"], ["volta", "retornar"]],
  targets: ["other_harley_revealed", "neo_joker_identity", "jack_rejection"],
  visualCues: [
    auditedCue("A outra Harley \u00e9 identificada enquanto o plano de Jack \u00e9 atacado", 4, [19], "other_harley_revealed", ["Marian Drews", "Neo Coringa", "Harleen", "Jack Napier"], ["outra Harley", "Marian", "Neo Coringa", "Harleen", "Jack"], 0.96),
    auditedCue("Marian confronta Jack e exige a volta do Coringa", 4, [20, 21], "neo_joker_identity", ["Marian Drews", "Neo Coringa", "Jack Napier", "Coringa"], ["Marian", "Neo Coringa", "Jack", "Coringa", "Gotham"], 0.95),
  ],
});
revise("rogue-control-stolen", {
  title: "Neo Coringa rouba o ex\u00e9rcito de Jack",
  narration: "A segunda parceira conhecia a fraqueza do plano. Por isso, a Neo Coringa rouba as cartas que controlavam os criminosos de Jack e os lan\u00e7a contra Gotham. Dois ataques come\u00e7am ao mesmo tempo. A cidade entra em guerra.",
  issueNumber: 5, pages: [4, 5, 6, 7],
  terms: [["Neo Coringa"], ["controle", "controlavam", "cartas"], ["ataques", "criminosos"], ["Jack"]],
  targets: ["control_cards_stolen", "rogue_double_attack", "gotham_under_attack"],
  visualCues: [
    auditedCue("Os her\u00f3is descobrem que Neo Coringa e o Chapeleiro sequestraram o controle", 5, [5], "control_cards_stolen", ["Neo Coringa", "Chapeleiro Louco", "criminosos"], ["Neo Coringa", "Chapeleiro", "controle mental", "cartas", "ataques"], 0.96),
    auditedCue("Os ataques coordenados colocam Gotham em perigo", 5, [6, 7], "gotham_under_attack", ["Gotham", "Batgirl", "Asa Noturna", "Batman"], ["Gotham", "cidade", "ataques", "Batgirl", "Asa Noturna", "Batman"], 0.91),
  ],
});
revise("batman-needs-jack", {
  title: "Harleen obriga Batman a encarar a verdade",
  narration: "A parceira original procura Batman e revela o que Jack escondeu: ele usou Cara-de-Barro para controlar os criminosos. Mesmo assim, ela insiste que Batman e Jack querem impedir a mesma trag\u00e9dia. Batman percebe uma verdade inc\u00f4moda porque s\u00f3 Jack entende o sistema roubado. Para impedir o ataque de Neo Coringa, ele teria de trabalhar justamente com Jack, seu advers\u00e1rio mais imprevis\u00edvel.",
  issueNumber: 5, pages: [8, 9, 10],
  terms: [["parceira", "original"], ["Batman", "Bruce"], ["Jack"], ["trabalhar", "juntos"]],
  targets: ["harleen_warns_batman", "jack_truth_revealed", "batman_needs_jack"],
  visualCues: [
    auditedCue("Harleen explica a Batman como Jack manipulou os criminosos", 5, [8, 9], "harleen_warns_batman", ["Harleen Quinzel", "Batman", "Jack Napier", "Cara-de-Barro"], ["Harleen", "Batman", "Jack", "Cara-de-Barro", "criminosos"], 0.96),
    auditedCue("Harleen diz que Batman e Jack s\u00f3 vencer\u00e3o se trabalharem juntos", 5, [10], "batman_needs_jack", ["Harleen Quinzel", "Batman", "Jack Napier"], ["Harleen", "Batman", "Jack", "juntos", "Gotham"], 0.95),
  ],
});
revise("freeze-history-and-weapon", {
  title: "O segredo dos Wayne aponta para uma arma sob Gotham",
  narration: "Um invasor entrava numa propriedade antiga atr\u00e1s de uma sala secreta. Sob a cidade, uma rede de t\u00faneis ligava projetos da fam\u00edlia do Senhor Frio aos projetos dos Wayne. A invasora n\u00e3o procurava dinheiro. Queria transformar aqueles projetos numa arma.",
  issueNumber: 5, pages: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  terms: [["Wayne"], ["Fries", "Frio"], ["t\u00faneis", "sala secreta"], ["tecnologia", "projetos"]],
  targets: ["wayne_secret_room", "fries_wayne_blueprints", "gotham_tunnels"],
  visualCues: [
    auditedCue("O Chapeleiro invade a propriedade Wayne e procura uma sala secreta", 5, [11, 12, 13], "wayne_secret_room", ["Chapeleiro Louco", "propriedade Wayne", "sala secreta"], ["Chapeleiro", "Wayne", "sala secreta", "segredo"], 0.94),
    auditedCue("Projetos antigos conectam as fam\u00edlias Fries e Wayne aos t\u00faneis de Gotham", 5, [14, 21, 22, 23], "fries_wayne_blueprints", ["fam\u00edlia Fries", "fam\u00edlia Wayne", "Gotham", "t\u00faneis", "arma"], ["Fries", "Wayne", "Gotham", "t\u00faneis", "projetos", "tecnologia", "arma"], 0.93),
  ],
});
revise("gotham-becomes-war-zone", {
  title: "A GTO e os antigos aliados de Batman o levam para Arkham",
  narration: "Antes que a crise do gelo come\u00e7asse, Gordon decidiu que a GTO prenderia Batman porque ele havia quebrado a lei. Asa Noturna apoiou a opera\u00e7\u00e3o porque acreditava que Bruce havia provocado a pr\u00f3pria queda. Batgirl ajudou a deter o antigo mentor. Ela exigiu que a m\u00e1scara de Batman ficasse protegida. Depois da persegui\u00e7\u00e3o, a equipe leva Batman para uma cela provis\u00f3ria. Essa arma come\u00e7a a funcionar. O gelo come\u00e7a a cobrir a cidade e tudo come\u00e7a a ruir. Quem conseguiria impedir que ela destru\u00edsse Gotham?",
  issueNumber: 6, pages: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  terms: [["GTO", "OTG"], ["Batman", "Bruce"], ["amea\u00e7a", "arma"], ["gelo", "congelar"]],
  targets: ["gto_chases_batman", "batman_captured", "freeze_weapon_active", "frozen_gotham"],
  visualCues: [
    auditedCue("Gordon autoriza a pris\u00e3o; Asa Noturna e Batgirl ajudam a GTO a capturar Batman", 6, [4, 5, 7, 8, 9, 10, 14, 15], "batman_captured", ["GTO", "Batman", "Comiss\u00e1rio Gordon", "Batgirl", "Asa Noturna"], ["GTO", "Batman", "Gordon", "Batgirl", "Asa Noturna", "capturado", "preso", "m\u00e1scara"], 0.97),
    auditedCue("Neo Coringa ativa a amea\u00e7a enquanto Batman permanece preso", 6, [16], "freeze_weapon_active", ["Neo Coringa", "Batman"], ["Neo Coringa", "Batman", "amea\u00e7a", "arma", "Gotham"], 0.9),
    auditedCue("O gelo avan\u00e7a e destr\u00f3i estruturas de Gotham", 6, [17, 18, 19, 20], "frozen_gotham", ["Gotham", "gelo", "cidade"], ["Gotham", "gelo", "congelamento", "cidade", "destrui\u00e7\u00e3o"], 0.95),
  ],
});


revise("jack-relapses", {
  narration: "A press\u00e3o aperta. Jack Napier, antigo vil\u00e3o medicado, quer salvar Gotham, mas cada crise devolve gestos do Coringa. Usar essa sombra ajuda contra Neo Coringa; tamb\u00e9m pode apagar Jack.",
  terms: [["Jack"], ["Coringa"], ["medicado", "gestos"], ["salvar Gotham"]],
});
revise("final-plan-formed", {
  narration: "Por isso, enquanto Jack lutava contra o Coringa dentro da pr\u00f3pria mente, a nova Coringa destru\u00eda Gotham por fora. Batman, Jack e a equipe de Gordon montam um plano simples: conter os vil\u00f5es, tirar civis das ruas e chegar at\u00e9 a arma final.",
  terms: [["Batman"], ["Jack"], ["equipe de Gordon", "for\u00e7a policial", "GTO", "Asa Noturna", "Batgirl"], ["plano", "arma final", "superarma"]],
});
revise("city-rescue", {
  narration: "Enquanto a for\u00e7a policial de Gotham protege civis e enfrenta os vil\u00f5es controlados, Batman abre caminho para Jack chegar ao centro da amea\u00e7a. Cada confronto compra segundos para salvar a cidade do gelo.",
});
revise("jack-accepts-cost", {
  narration: "Jack entende o pre\u00e7o da vit\u00f3ria. Para prever Neo Coringa, precisa se aproximar da mente que tentou abandonar. Se recuar, o perigo vence; se avan\u00e7ar, talvez Jack desapare\u00e7a.",
  terms: [["Jack"], ["Neo Coringa", "Coringa"], ["mente", "desaparece"], ["perigo", "vence"]],
});
revise("batman-and-jack-confront-neo", {
  narration: "Quando o plano chega ao limite, Batman e Jack alcan\u00e7am Neo Coringa por caminhos diferentes. Bruce abre passagem pela for\u00e7a; Jack entende o caos por dentro. O confronto s\u00f3 funciona porque os dois aceitam lutar juntos.",
});
revise("jack-sacrifices-his-future", {
  narration: "Para impedir a destrui\u00e7\u00e3o, Jack entrega o que ainda restava de sua vida como Jack Napier. Se ele falhar, Gotham cai e o Coringa volta de vez. Ele escolhe fazer o certo quando o custo se torna pessoal.",
  terms: [["Jack Napier", "Jack"], ["Gotham", "falhar"], ["Coringa"], ["escolhe", "custo"]],
});
revise("batman-accepts-accountability", {
  narration: "Com isso, Bruce entende a consequ\u00eancia. Jack estava certo: proteger Gotham n\u00e3o dava a Batman o direito de ficar acima da lei. Agora Bruce tamb\u00e9m precisa responder pelo que fez.",
  terms: [["Bruce", "Batman"], ["Jack"], ["acima da lei"], ["responder"]],
});
revise("gotham-redefines-heroes", {
  narration: "No fim, Jack n\u00e3o era her\u00f3i perfeito, e Batman n\u00e3o era vil\u00e3o simples. Gotham sobrevive quando seus s\u00edmbolos aceitam limites. Se ningu\u00e9m responder pelos riscos, a cidade volta a cair.",
});

const partTwoOrder = ["backport-fund-exposed", "jack-controls-rogues", "bruce-family-secrets", "nightwing-breaks-with-batman", "gto-created", "nightwing-and-batgirl-join-gto"];
const partTwoIds = new Set(partTwoOrder);
const remainingDetails = details.filter((detail) => !partTwoIds.has(detail.id));
const storyDetails = [...remainingDetails.slice(0, 5), ...partTwoOrder.map((id) => details.find((detail) => detail.id === id)), ...remainingDetails.slice(5)];

const events = storyDetails.map((detail, index) => {
  const beat = base.beats[index];
  if (!beat) throw new Error(`Missing base beat for narrative event ${detail.id}`);
  const previous = storyDetails[index - 1];
  const next = storyDetails[index + 1];
  return {
    eventId: detail.id,
    beatIds: [`saga-beat-${index + 1}`],
    issueNumber: detail.issueNumber ?? beat.issueNumber,
    pageNumbers: detail.pages ?? beat.pages,
    sequence: index + 1,
    title: detail.title,
    narrationText: detail.narration,
    actors: detail.actors,
    action: detail.action,
    motivation: detail.motivation,
    causes: previous ? [previous.id] : [],
    consequences: next ? [next.id] : [],
    facts: [{
      factId: `fact-${detail.id}`,
      statement: detail.narration,
      importance: "critical",
      requiredNarrationTerms: detail.terms,
      sourcePages: detail.pages ?? beat.pages,
    }],
    visualTargets: detail.targets,
    mustNarrate: true,
    visualCues: detail.visualCues ?? [],
  };
});

const chapters = base.issueRanges.map((range) => {
  const chapterEvents = events.filter((event) => event.issueNumber === range.issueNumber);
  return {
    issueNumber: range.issueNumber,
    title: `Batman: Cavaleiro Branco - Edicao ${range.issueNumber}`,
    storyPages: Array.from({ length: range.lastStoryPage - range.firstStoryPage + 1 }, (_, index) => range.firstStoryPage + index),
    eventIds: chapterEvents.map((event) => event.eventId),
    beginning: chapterEvents[0].narrationText,
    centralConflict: chapterEvents[Math.floor(chapterEvents.length / 2)].narrationText,
    turningPoint: chapterEvents.at(-1).narrationText,
    outcome: chapterEvents.at(-1).narrationText,
    openThreads: chapterEvents.at(-1).consequences,
    resolvedThreads: chapterEvents.slice(1).flatMap((event) => event.causes),
  };
});

export const narrativeBibleInput = {
  sagaId: "batman-white-knight-issues-01-08",
  title: "Batman: Cavaleiro Branco",
  premise: "Depois de Batman forca-lo a engolir comprimidos, o Coringa recupera a lucidez como Jack Napier e tenta salvar Gotham expondo o custo do proprio Batman.",
  centralQuestion: "Jack Napier consegue realmente mudar sem que Batman e o Coringa destruam a cidade antes?",
  chapters,
  events,
  relationships: [
    {
      relationshipId: "bruce-dick",
      participants: ["Bruce Wayne", "Dick Grayson"],
      initialState: "parceiros unidos pela missao",
      changes: [
        { eventId: "nightwing-breaks-with-batman", state: "ruptura", reason: "Dick rejeita a violencia e o controle de Bruce" },
        { eventId: "final-plan-formed", state: "cooperacao com limites", reason: "a cidade exige trabalho conjunto" },
      ],
      finalState: "aliados que nao aceitam mais obediencia cega",
    },
    {
      relationshipId: "jack-joker",
      participants: ["Jack Napier", "Coringa"],
      initialState: "Jack emerge com a medicacao",
      changes: [
        { eventId: "jack-medicine-fails", state: "lucidez instavel", reason: "o efeito dos remedios enfraquece" },
        { eventId: "jack-sacrifices-his-future", state: "sacrificio", reason: "Jack escolhe Gotham acima da identidade" },
      ],
      finalState: "mudanca moral comprovada, embora a cura nunca fosse absoluta",
    },
  ],
};

export const episodeDefinitions = [
  {
    episodeId: "white-knight-01-origin-of-jack",
    title: "Como Batman criou seu proprio Cavaleiro Branco",
    eventIds: events.slice(0, 5).map((event) => event.eventId),
    hook: "Batman transformou o Coringa em seu maior acusador.",
    context: "Em Gotham, Batman perseguia o Coringa, seu inimigo recorrente, atÃ© perder o controle diante da prÃ³pria polÃ­cia.",
    payoff: "Jack conquista a aten??o de Gotham, enquanto Harley percebe que a lucidez dele depende dos rem?dios.",
    rewindLabel: "Um ano antes",
    nextEpisodeHook: "E quando Jack descobre quem lucra com a destruicao de Gotham, a guerra deixa de ser pessoal.",
  },
  {
    episodeId: "white-knight-02-city-chooses-jack",
    title: "Como Jack virou Gotham contra Batman",
    eventIds: events.slice(5, 11).map((event) => event.eventId),
    coldOpenPage: "i02-page-0020.jpg",
    hook: "Jack Napier exp\u00f4s o neg\u00f3cio de Batman em Gotham.",
    context: "Depois de recuperar a lucidez, Jack Napier conquistou Gotham e passou a investigar o custo escondido da guerra de Batman.",
    payoff: "Jack exp\u00f5e o neg\u00f3cio por tr\u00e1s da destrui\u00e7\u00e3o, controla os antigos vil\u00f5es e oferece a Gotham uma alternativa que pode afastar de Bruce at\u00e9 sua pr\u00f3pria fam\u00edlia.",
    nextEpisodeHook: "Quando uma segunda Coringa rouba esse controle, a solucao de Jack se torna a maior ameaca da cidade.",
  },
  {
    episodeId: "white-knight-03-neo-joker-war",
    title: "Como a Neo Coringa transformou o plano de Jack em guerra",
    eventIds: events.slice(11, 17).map((event) => event.eventId),
    coldOpenPage: "i04-page-0020.jpg",
    hook: "A outra Harley queria arrancar o Coringa de Jack.",
    context: "Jack Napier ainda tentava preservar a lucidez que recuperara. Mas Marian Drews, a segunda Harley Quinn, queria obrig\u00e1-lo a voltar a ser o Coringa.",
    visualPromiseTerms: ["Harley", "Coringa", "Jack"],
    contextAnchors: [
      { entity: "Jack Napier", explanationTerms: ["lucidez"] },
      { entity: "Marian Drews", explanationTerms: ["segunda Harley Quinn"] },
    ],
    rewindLabel: "Pouco antes",
    hookHeadline: "A OUTRA HARLEY QUERIA O CORINGA DE VOLTA",
    issueTransitionEvidence: [
      { fromIssueNumber: 4, toIssueNumber: 5, previousConflictTerms: ["segunda Harley", "Neo Coringa"], causalBridgeTerms: ["por isso", "agora", "porque", "quando"], newConflictTerms: ["Neo Coringa"] },
      { fromIssueNumber: 5, toIssueNumber: 6, previousConflictTerms: ["arma"], causalBridgeTerms: ["antes que", "quando", "depois", "enquanto"], newConflictTerms: ["GTO", "Batman"] },
    ],
    payoff: "O segredo dos Wayne entrega a Marian uma arma capaz de congelar Gotham justamente quando Batman ? capturado.",
    nextEpisodeHook: "Agora Batman precisa confiar no inimigo, antes que Jack desapareca dentro do Coringa.",
  },
  {
    episodeId: "white-knight-04-final-choice",
    title: "A escolha final de Jack e a queda do mito de Batman",
    eventIds: events.slice(17).map((event) => event.eventId),
    hook: "Para salvar Gotham, Batman teria de lutar ao lado do homem que jurou destruir. Jack teria de arriscar a propria identidade.",
    context: "Com a cidade congelando, antigos inimigos e aliados finalmente recebem funcoes claras no mesmo plano de resgate.",
    payoff: "Jack prova sua mudanca pelo sacrificio, e Bruce admite que nem mesmo Batman pode permanecer acima da lei.",
  },
];

const finalChoiceEpisode = episodeDefinitions.find((episode) => episode.episodeId === "white-knight-04-final-choice");
if (finalChoiceEpisode) {
  Object.assign(finalChoiceEpisode, {
    coldOpenPage: "i06-page-0017.jpg",
    hook: "Jack e Coringa decidiam o destino de Gotham.",
    context: "Gotham estava em colapso. Jack Napier, antigo Coringa, perdia a lucidez; Neo Coringa tomou o controle dos vil\u00f5es; Batman precisa salvar Gotham e precisa confiar em Jack; e a GTO virou for\u00e7a policial de resgate.",
    visualPromiseTerms: ["Jack", "Coringa", "Gotham"],
    contextAnchors: [
      { entity: "Jack Napier", explanationTerms: ["antigo Coringa", "lucidez", "medicado"] },
      { entity: "Neo Coringa", explanationTerms: ["tomou o controle", "viloes"] },
      { entity: "Batman", explanationTerms: ["precisa salvar Gotham", "precisa confiar em Jack"] },
      { entity: "GTO", explanationTerms: ["forca policial", "resgate"] },
    ],
    rewindLabel: "Pouco antes",
    hookHeadline: "JACK ESTAVA PERDENDO O CONTROLE",
    issueTransitionEvidence: [
      { fromIssueNumber: 6, toIssueNumber: 7, previousConflictTerms: ["Jack", "Coringa", "Neo Coringa"], causalBridgeTerms: ["por isso", "com Jack"], newConflictTerms: ["Batman", "forca policial", "equipe de Gordon", "plano"] },
      { fromIssueNumber: 7, toIssueNumber: 8, previousConflictTerms: ["plano", "Gotham", "Jack"], causalBridgeTerms: ["quando", "plano"], newConflictTerms: ["Neo Coringa", "confronto", "sacrificio"] },
    ],
    payoff: "Jack salva Gotham pagando com a pr\u00f3pria identidade. Bruce entende a li\u00e7\u00e3o: Batman tamb\u00e9m precisa responder pela lei.",
  });
}

export default { narrativeBibleInput, episodeDefinitions };
