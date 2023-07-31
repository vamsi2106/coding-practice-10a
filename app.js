const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const app = express();
app.use(express.json());
const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

//connecting db
const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running At http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};
initializeDBAndServer();

//Authentication Middleware parser
let authentication = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "DAD_MOM", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

//API-1
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatch) {
      response.status(200);
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "DAD_MOM");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API-2
app.get("/states/", authentication, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`;
  const getStates = await db.all(getStatesQuery);
  const getStatesArray = getStates.map((obj) => {
    return {
      stateId: obj.state_id,
      stateName: obj.state_name,
      population: obj.population,
    };
  });
  response.send(getStatesArray);
});

//API-3
app.get("/states/:stateId", authentication, async (request, response) => {
  const { stateId } = request.params;
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`;
  const getState = await db.get(getStateQuery);
  response.send({
    stateId: getState.state_id,
    stateName: getState.state_name,
    population: getState.population,
  });
});

//API-4
app.post("/districts/", authentication, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtsQuery = `
            INSERT INTO 
                     district(district_name, state_id, cases, cured, active, deaths)
            VALUES (
                '${districtName}', 
                ${stateId}, 
                ${cases},
                ${cured},
                ${active}, 
                ${deaths} 
                );`;
  await db.run(districtsQuery);
  response.send("District Successfully Added");
});

//API-5
app.get(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `SELECT * FROM district WHERE district_id = ${districtId}`;
    const getDistrict = await db.get(districtQuery);
    response.send({
      districtId: getDistrict.district_id,
      districtName: getDistrict.district_name,
      stateId: getDistrict.state_id,
      cases: getDistrict.cases,
      cured: getDistrict.cured,
      active: getDistrict.active,
      deaths: getDistrict.deaths,
    });
  }
);

//API-6
app.delete(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const deleteQuery = `DELETE FROM district WHERE district_id = ${districtId}`;
    await db.run(deleteQuery);
    response.send("District Removed");
  }
);

//API-7
app.put(
  "/districts/:districtId/",
  authentication,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const updateQuery = `
            UPDATE 
                district
            SET 
                district_name = '${districtName}',
                state_id = ${stateId},
                cases = ${cases},
                cured = ${cured},
                active = ${active},
                deaths = ${deaths}
            WHERE 
                district_id = ${districtId};
            `;
    await db.run(updateQuery);
    response.send("District Details Updated");
  }
);

//API-8
app.get(
  "/states/:stateId/stats/",
  authentication,
  async (request, response) => {
    const { stateId } = request.params;
    const statsQuery = `
                    SELECT 
                        SUM(D.cases) AS totalCases,
                        SUM(D.cured) AS totalCured,
                        SUM(D.active) AS totalActive,
                        SUM(D.deaths) AS totalDeaths
                    FROM district AS D
                        INNER JOIN state AS S
                    WHERE 
                        D.state_id = ${stateId} AND
                        D.state_id = S.state_id;
                    `;
    const stats = await db.get(statsQuery);
    response.send({
      totalCases: stats.totalCases,
      totalCured: stats.totalCured,
      totalActive: stats.totalActive,
      totalDeaths: stats.totalDeaths,
    });
  }
);

module.exports = app;
