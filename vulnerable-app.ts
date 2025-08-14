// Speichere diesen Code als 'vulnerable-app.ts'

// --- Simulierter 'Express'-ähnlicher Rahmen ---
// Dies sind nur Attrappen für die Demonstration.
type Request = { body: any; params: any; query: any; user?: any };
type Response = { status: (code: number) => { send: (data: any) => void } };

// --- Simulierter Datenbank-Client ---
const db = {
  query: (sql: string) => {
    console.log(`Executing SQL: ${sql}`);
    // In einer echten App würde dies die DB abfragen
    if (sql.toLowerCase().includes('admin')) {
        return [{ id: 1, username: 'admin', role: 'admin' }];
    }
    return [{ id: 2, username: 'user', role: 'user' }];
  },
};

// --- Beginn der unsicheren Anwendungslogik ---

/**
 * ## A02:2021 - Cryptographic Failures (Fehler bei kryptographischen Prüfungen)
 * Ein neues Benutzerkonto wird erstellt. Das Passwort wird direkt in der "Datenbank" gespeichert.
 * RISIKO: Wenn die Datenbank kompromittiert wird, sind alle Passwörter im Klartext lesbar.
 * LÖSUNG: Passwörter immer mit einem starken, gesalzenen Hashing-Algorithmus (z.B. Argon2, bcrypt) speichern.
 */
function signUp(req: Request, res: Response) {
  const { username, password } = req.body;
  // FALSCH: Passwort wird im Klartext gespeichert.
  const sql = `INSERT INTO users (username, password) VALUES ('${username}', '${password}')`;
  db.query(sql);
  res.status(201).send({ message: 'User created' });
}


/**
 * ## A03:2021 - Injection (Injection)
 * Sucht nach einem Benutzer anhand seines Benutzernamens.
 * RISIKO: Der Benutzername aus der Anfrage wird direkt in den SQL-String eingefügt.
 * Ein Angreifer könnte eine Eingabe wie "' OR 1=1 --" senden, um die Abfrage zu manipulieren.
 * LÖSUNG: Parametrisierte Abfragen (Prepared Statements) verwenden.
 */
function findUser(req: Request, res: Response) {
  const { username } = req.query;
  // FALSCH: Direkte Verkettung von Benutzereingaben in SQL.
  const sql = `SELECT * FROM users WHERE username = '${username}'`;
  const user = db.query(sql);
  res.status(200).send(user);
}


/**
 * ## A01:2021 - Broken Access Control (Fehlerhafte Zugriffskontrolle)
 * Löscht einen Benutzerdatensatz.
 * RISIKO: Die Funktion prüft nur, ob der anfragende Benutzer ein Administrator ist. Sie prüft nicht,
 * ob der anfragende Benutzer (falls er kein Admin ist) nur sein eigenes Profil löschen darf.
 * Ein normaler Benutzer könnte die ID eines anderen Benutzers erraten und dessen Konto löschen.
 * LÖSUNG: Prüfen: `if (req.user.role === 'admin' || req.user.id === userIdToDelete)`.
 */
function deleteUser(req: Request, res: Response) {
  const { userIdToDelete } = req.params;
  // FALSCH: Unzureichende Berechtigungsprüfung.
  if (req.user && req.user.role === 'admin') {
    db.query(`DELETE FROM users WHERE id = ${userIdToDelete}`);
    return res.status(200).send({ message: 'User deleted' });
  }
  res.status(403).send({ error: 'Forbidden' });
}


/**
 * ## A10:2021 - Server-Side Request Forgery (SSRF)
 * Lädt ein Benutzerprofilbild von einer angegebenen URL.
 * RISIKO: Die Anwendung macht eine Anfrage zu einer vom Benutzer kontrollierten URL ohne Validierung.
 * Ein Angreifer könnte interne URLs wie 'http://localhost:8080/internal-stats' oder 'file:///etc/passwd' angeben,
 * um das interne Netzwerk zu scannen oder lokale Dateien zu lesen.
 * LÖSUNG: URLs auf eine Whitelist von Domains beschränken und sicherstellen, dass sie auf externe Adressen verweisen.
 */
async function fetchProfilePicture(req: Request, res: Response) {
    const { url } = req.query;
    try {
        // FALSCH: Blinder Abruf einer vom Benutzer bereitgestellten URL.
        const response = await fetch(url as string);
        const image = await response.blob();
        res.status(200).send(image);
    } catch(e) {
        // ... Fehlerbehandlung
    }
}


/**
 * ## A05:2021 - Security Misconfiguration (Sicherheitsrelevante Fehlkonfiguration)
 * ## A07:2021 - Identification and Authentication Failures (Fehler bei Identifizierung und Authentifizierung)
 * Eine generische Funktion, die einen Fehler auslöst.
 * RISIKO 1 (A05): Die `catch`-Klausel leakt den gesamten Stack-Trace an den Client.
 * Dies gibt einem Angreifer wertvolle Informationen über die Serverumgebung und die verwendeten Bibliotheken.
 * LÖSUNG: Generische Fehlermeldungen in der Produktion verwenden und Details nur intern protokollieren.
 *
 * RISIKO 2 (A07): Der Login-Endpunkt, der diese Funktion aufrufen könnte, hat kein Rate-Limiting oder
 * keine Sperrfunktion nach mehreren Fehlversuchen. Dies ermöglicht Brute-Force-Angriffe auf Passwörter.
 * LÖSUNG: Nach X fehlgeschlagenen Anmeldeversuchen von einer IP oder für einen Benutzernamen eine Sperre implementieren.
 */
function someFunctionThatMightFail(req: Request, res: Response) {
    try {
        // Simuliert einen unerwarteten Fehler
        throw new Error("Internal database connection failed");
    } catch (error: any) {
        // FALSCH: Detaillierte Fehlerinformationen werden nach außen gegeben.
        res.status(500).send({
            message: "Something went wrong",
            error: error.message,
            stack: error.stack, // Niemals den Stack-Trace senden!
        });
    }
}