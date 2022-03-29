var router = require("express").Router();
const bodyParser = require("body-parser");
const request = require("request");
const jwt = require("express-jwt");
const jwksRsa = require("jwks-rsa");
const checkJwt = require("../lib/middleware/checkJwt");
const { Datastore } = require("@google-cloud/datastore");
const projectId = "fp-alamgirj";
const datastore = new Datastore({ projectId: projectId });
//var HTMLParser = require("node-html-parser");

const BOAT = "Boats";
const LOAD = "loads";

const ds = require("./datastore");

function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}

router.use(bodyParser.json());
//   const handle_jwt_error = function(err, req, res, next) {
//     if (err.name == 'UnauthorizedError') {
//     res.status(401).send(JSON.parse('{"Error": "Invalid or missing authorization token"}'));
//     } else {
//         next();
//     }
// }

// router.use(check_jwt);
// router.use(handle_jwt_error);

function isEmpty(obj) {
    return Object.keys(obj).length === 0;
}

function get_boat(id) {
    console.log("id is here " + id);
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(fromDatastore);
        }
    });
}

function post_boat(name, type, length, owner, public) {
    var key = datastore.key(BOAT);
    const new_lodging = {
        name: name,
        type: type,
        length: length,
        owner: owner,
        public: public,
    };
    return datastore.save({ key: key, data: new_lodging }).then(() => {
        return key;
    });
}

// function get_boats() {
//     const q = datastore.createQuery(BOAT);
//     return datastore.runQuery(q).then((entities) => {
//         // Use Array.map to call the function fromDatastore. This function
//         // adds id attribute to every element in the array at element 0 of
//         // the variable entities
//         return entities[0].map(fromDatastore);
//     });
// }
//reference for query https://cloud.google.com/datastore/docs/concepts/queries#datastore-datastore-basic-query-nodejs
function get_boats(req, user_sub) {
    var q = datastore.createQuery(BOAT).filter("owner", user_sub).limit(5);
    const results = {};
    if (Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(ds.fromDatastore);
        if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            results.next =
                req.protocol +
                "://" +
                req.get("host") +
                req.baseUrl +
                "?cursor=" +
                entities[1].endCursor;
        }
        return results;
    });
}

function get_public_boats(req) {
    var q = datastore.createQuery(BOAT).filter("public", true).limit(5);
    const results = {};
    if (Object.keys(req.query).includes("cursor")) {
        q = q.start(req.query.cursor);
    }
    return datastore.runQuery(q).then((entities) => {
        results.items = entities[0].map(ds.fromDatastore);
        if (entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS) {
            results.next =
                req.protocol +
                "://" +
                req.get("host") +
                req.baseUrl +
                "?cursor=" +
                entities[1].endCursor;
        }
        return results;
    });
}

async function delete_boat(id, ownerId) {
    //console.log('deleting her');
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    const ourBoat = await get_boat(id);
    if (ourBoat[0] === undefined || ourBoat[0] === null) {
        return -2;
    } else if (ourBoat[0].loads != undefined && Object.entries(ourBoat[0].loads).length != 0 ){
        return -31;
    }else if (ourBoat[0].owner != ownerId) {
        return -3;
    } else {
        return datastore.delete(key);
    }
}
// const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
// await delay(1000);

// function check_public(boat_id){
//     const ourBoat = get_boat(boat_id).then((varHolder)=>{
//         if(varHolder.public == true){
//             return true;
//         }else{
//             return false;
//         }
//     });
// }

async function patch_boat(id, name, type, length, public, userSub) {
    var key = datastore.key([BOAT, parseInt(id, 10)]);
    // const existingBoat = await datastore.get(key).then((boat) => {
    //     if (boat == undefined || boat == false) {
    //         return -1;
    //     }
    //     return boat;
    // });
    const existingBoat = await get_boat(id);
    if (existingBoat == false || existingBoat === -1) {
        return -1;
    }else if(existingBoat[0].owner != userSub){
        return -22;
    } else {
        const updatedBoat = {
            name: existingBoat[0].name,
            type: existingBoat[0].type,
            length: existingBoat[0].length,
            public: existingBoat[0].public,
            owner: existingBoat[0].owner,
        };
        if (existingBoat[0].loads !== undefined && !isEmpty(existingBoat[0].loads)){
            // console.log('not empty');
            // loadIsBooked = true;
            updatedBoat["loads"] = existingBoat[0].loads;
        }
        if (name !== undefined && name !== "") {
            updatedBoat["name"] = name;
        }
        if (type !== undefined && type !== "") {
            updatedBoat["type"] = type;
        }
        if (length !== undefined && length !== "") {
            updatedBoat["length"] = length;
        }
        if (public !== undefined && public !== "") {
            updatedBoat["public"] = public;
        }
        const new_entity = {
            key: key,
            data: updatedBoat,
        };
        return datastore
            .update(new_entity)
            .then(() => {
                return new_entity.data;
            })
            .catch(() => {
                return false;
            });
    }
    // console.log('our data ' + existingBoat);
}

async function put_boat(id, name, type, length, public, userSub) {
    var key = datastore.key([BOAT, parseInt(id, 10)]);
    // const existingBoat = await datastore.get(key).then((boat) => {
    //     if (boat == undefined || boat == false) {
    //         return -1;
    //     }
    //     return boat;
    // });
    const existingBoat = await get_boat(id);
    if (existingBoat == false || existingBoat === -1) {
        return -1; // boat doesn't exist with that id
    }
    if(existingBoat[0].owner != userSub){
        return -22;
    }
    if (existingBoat[0].loads !== undefined && !isEmpty(existingLoad[0].carrier)){
        // console.log('not empty');
        // loadIsBooked = true;
        updatedBoat["loads"] = existingBoat[0].loads;
    }
    if (name == "" || type == "" || length == "" || public == "") {
        return -6; //one of the values does not exist
    }
    // if (!isValidName(name) || !isValidName(type) || !Number.isInteger(length) || !isFinite(parseInt(length, 10))) {
    //     return -8; //name is not valid by type
    // }
    // if (await duplicateNameCheck(name)) {
    //     return -7; // duplicate name
    // }
    // if (
    //     existingBoat[0].name == name ||
    //     existingBoat[0].type == type //||
    //     //existingBoat[0].length == length
    // ) {
    //     return -9; // not changing all three attributes
    // }
    const updatedBoat = {
        name: name,
        type: type,
        length: length,
        public: public,
        owner: existingBoat[0].owner,
        id: existingBoat[0].id,
    };
    const update_boat = {
        key: key,
        data: updatedBoat
    }
    // return datastore.save({ key: key, data: updatedBoat });
    return datastore.update(update_boat).then(() => {
        return update_boat.data
    }).catch(() => {
        return false;
    })
}

/**********************************************************
 Load Functions
***********************************************************/
function get_load(id) {
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(fromDatastore);
        }
    });
}

async function put_load_on_boat(boatId, loadId) {
    var alreadyExists = false;
    var loadIsBooked = false;
    const loadKey = datastore.key([LOAD, parseInt(loadId, 10)]);
    const boatKey = datastore.key([BOAT, parseInt(boatId, 10)]);
    return datastore.get(loadKey).then((load) => {
        if (load[0] == undefined || load[0] === null) {
            return -2;
        } else {
            return datastore.get(boatKey).then((boat) => {
                if (boat[0] == undefined || boat[0] === null) {
                    return -4;
                } else {
                    if (typeof boat[0].loads === "undefined") {
                        console.log('is not defined ');
                        boat[0].loads = [];
                    } else {
                        boat[0].loads.forEach((eachload) => {
                            if (eachload.id === loadId) {
                                console.log('is defined');
                                alreadyExists = true;
                            }
                        });
                    }
                    if (alreadyExists == true) {
                        return -5;
                    }
                    // console.log('looad ' + load[0].carrier);
                    // if (!isEmpty(load[0].carrier) || typeof load[0].carrier !== "undefined"){
                    //     console.log('I am here ')
                    //     if (load[0].carrier[0] !== undefined) {
                    //         loadIsBooked = true;
    
                    //     }
                    // }
                    // else {
                    //     load[0].carrier = [];
                    // }
                    if (load[0].carrier !== undefined && !isEmpty(load[0].carrier)){
                        console.log('not empty');
                        loadIsBooked = true;
                    }
                    else{
                        console.log('is empty');
                        loadIsBooked = false;
                        load[0].carrier = [];
                    }
                    if (loadIsBooked == true) {
                        return -5;
                    }

                    boat[0].loads.push({
                        id: loadId,
                    });
                    datastore.save({ key: boatKey, data: boat[0] });
                    load[0].carrier.push({
                        id: boatId,
                        name: boat[0].name,
                    });
                    return datastore.save({ key: loadKey, data: load[0] });
                }
            });
        }
    });
}

async function delete_load_from_boat(boatId, loadId) {
    var notExisting = false;
    var invalidBoatId = true;
    var invalidLoadId = true;
    const loadKey = datastore.key([LOAD, parseInt(loadId, 10)]);
    const boatKey = datastore.key([BOAT, parseInt(boatId, 10)]);
    return datastore.get(loadKey).then((load) => {
        if (load[0] == undefined || load[0] === null) {
            return -2;
        } else {
            return datastore.get(boatKey).then((boat) => {
                if (boat[0] == undefined || boat[0] === null) {
                    return -4;
                } else {
                    if (typeof boat[0].loads === "undefined") {
                        notExisting = true;
                    }

                    if (typeof load[0].carrier == "undefined") {
                        notExisting = true;
                    }
                    if (notExisting == true) {
                        return -5; //boat doesn't have that load
                    }
                    boat[0].loads.forEach((eachload) => {
                        if (eachload.id === loadId) {
                            invalidBoatId = false;
                        }
                    });
                    if (!isEmpty(load[0].carrier)){
                        if(load[0].carrier[0].id == boatId){

                            invalidLoadId = false;
                        }
                    }

                    // load[0].carrier.forEach((eachBoat) => {
                    //     if (eachBoat.id === boatId) {
                    //         invalidLoadId = false;
                    //     }
                    // });

                    if (invalidBoatId == true || invalidLoadId == true) {
                        return -6;
                    } else {
                        var deleteIndex = -1;
                        var eachIndex = 0;
                        boat[0].loads.forEach((eachload) => {
                            if (eachload.id === loadId) {
                                deleteIndex = eachIndex;
                            }
                            eachIndex++;
                        });
                        if (deleteIndex != -1) {
                            delete boat[0].loads[deleteIndex];
                        }
                        datastore.save({ key: boatKey, data: boat[0] });
                        load[0].carrier = {};
                        return datastore.save({ key: loadKey, data: load[0] });
                    }
                }
            });
        }
    });
}

/**********************************************************
 Router Functions
***********************************************************/

router.delete("/:boatId/loads/:loadId", function (req, res) {
    //now delete
    delete_load_from_boat(req.params.boatId, req.params.loadId).then(
        (boatVar) => {
            console.log('boat var ' + boatVar);
            if (boatVar == -2 || boatVar == -4) {
                res.status(404).json({
                    Error: "The specified boat and/or load does not exist",
                });
            }
            else if (boatVar == -5 || boatVar == -6) {
                res.status(404).json({
                    Error: "The specified boat and/or load does not exist",
                });
            } else {
                res.status(204).send();
            }
        }
    );
});

router.put("/:boatId/loads/:loadId", function (req, res) {
    put_load_on_boat(req.params.boatId, req.params.loadId).then((boatVar) => {
        console.log('put request' + boatVar);
        if (boatVar == -2) {
            res.status(404).json({
                Error: "The specified boat and/or load does not exist",
            });
        }
        else if (boatVar == -4) {
            res.status(404).json({
                Error: "The specified boat and/or load does not exist",
            });
        }
        else 
        if (boatVar == -5) {
            res.status(403).json({
                Error: "The specified load is already assigned.",
            });
        }
        else {
            res.status(204).send();
        }
    });
});

router.put("/:id", checkJwt, function (req, res) {
    console.log("this req is coming in ");
    const accepts = req.accepts(["application/json"]);
   
     if (req.get("content-type") !== "application/json") {
        res.status(415).send("Server only accepts application/json data.");
    }
   else if (!accepts) {
        res.status(406).send("Not Acceptable");
    }
    else if (req.body.name == "" || req.body.type == "" || req.body.length == "" || req.body.public == "" ||
    req.body.name == undefined || req.body.type == undefined || req.body.length == undefined || req.body.public == undefined
    ) {
        res.status(400).json({
            Error: "Not all attributes of the boat are being updated",
        });
    }else if(req.body.id != undefined){
        res.status(403).send("The Id cannot be changed");
    }
    else {

    put_boat(req.params.id, req.body.name, req.body.type, req.body.length, req.body.public, req.user.sub).then(
        (myvar) => {
            console.log("My var is: " + JSON.stringify(myvar));
            if (myvar == -1) {
                res.status(404).json({
                    Error: "No boat with that ID",
                });
            } else if(myvar == -22){
                res.status(403).json({Error: "Only the owner can modify boats created by them"});
            } else if (myvar == -6) {
                res.status(400).json({
                    Error: "Name, type or length is empty",
                });
            } else if (myvar == -8) {
                res.status(400).json({
                    Error: "Name, type, or length is not a valid input type",
                });
            } else if (myvar == -7) {
                res.status(403).json({
                    Error: "A boat with that name already exists",
                });
            } else if (myvar == -9) {
                res.status(400).json({
                    Error: "not all attributes are being modified",
                });
            } else {
                res.location(
                    req.protocol +
                        "://" +
                        req.get("host") +
                        req.baseUrl +
                        "/" +
                        myvar.id
                );
                res.status(303).send();
            }
        }
    );
    }
});

router.post("/", checkJwt, function (req, res) {
    const accepts = req.accepts(["application/json"]);
    if (!accepts) {
        res.status(406).send("Not Acceptable");
    } else if (req.get("content-type") !== "application/json") {
        res.status(415).send("Server only accepts application/json data.");
    } else if (
        req.body.name === undefined ||
        req.body.type === undefined ||
        req.body.length === undefined || 
        req.body.public === undefined
    ) {
        res.status(400).json({
            Error: "The request object is missing at least one of the required attributes",
        });
    } else {
        //console.log('here is the request' + JSON.stringify(req.user.sub));
        //console.log('here is the body req' + JSON.stringify(req.body));
        post_boat(
            req.body.name,
            req.body.type,
            req.body.length,
            req.user.sub,
            req.body.public
        ).then((key) => {
            // res.location(req.protocol + "://" + req.get('host') + req.baseUrl + '/' + key.id);
            var urlSet =
                req.protocol +
                "://" +
                req.get("host") +
                req.originalUrl +
                "/" +
                key.id;
            const obj = {
                id: key.id,
                name: req.body.name,
                type: req.body.type,
                length: req.body.length,
                self: urlSet,
                public: req.body.public,
            };
            res.status(201).send(JSON.stringify(obj, null, 2));
        });
    }
});

router
    .delete("/:boat_id", checkJwt, function (req, res) {
        var userSub = req.user.sub;
        delete_boat(req.params.boat_id, userSub).then((returnVar) => {
            if (returnVar == -2) {
                res.status(404).json({
                    Error: "No boat with this boat_id exists",
                });
            } else if (returnVar == -3) {
                res.status(403).send(
                    JSON.stringify("Boat owned by some other user")
                );
            } else if(returnVar == -31){
                res.status(403).send(JSON.stringify("A boat can only be deleted after its loads are removed"));
            } else if (returnVar == -4) {
                res.status(403).send(
                    JSON.stringify("No boat with this boat_id exists")
                );
            } else {
                res.status(204).send();
            }
        });
    })
    .use((err, req, res, next) => {
        res.status(401).send(JSON.stringify("Missing or invalid JWT"));
    });

router
    .get("/", checkJwt, function (req, res) {
        const accepts = req.accepts(["application/json"]);
        if (!accepts) {
            res.status(406).send("Not Acceptable");
        }
        // //valid jwt
        // var userSub = req.user.sub;
        // let boatArr = [];
        // const boats = get_boats(req).then((boats) => {
        //     // res.status(200).json(boats);
        //     if (boats !== undefined && boats.length !== undefined){
        //         boats.forEach(element => {
        //             if (element.owner == userSub){
        //                 boatArr.push(element);
        //             }
        //         });
        //         res.status(200).send(JSON.stringify(boatArr));
        //     }
        //     else{
        //         res.status(200).send(JSON.stringify('No public/private boats are available for this Owner'));
        //     }
        //     // if
        // });
        get_boats(req, req.user.sub).then((varHolder) => {
            // res.status(200).send(varHolder);
            if (!isEmpty(varHolder)) {
                varHolder.items.forEach((element) => {
                    var urlSet =
                        req.protocol +
                        "://" +
                        req.get("host") +
                        "/boats" +
                        "/" +
                        element.id;
                    element["self"] = urlSet;
                });
                res.status(200).send(JSON.stringify(varHolder));
            } else {
                res.status(200).send(
                    JSON.stringify("No boats in datastore for this jwt")
                );
            }
        });
    })
    .use((err, req, res, next) => {
        //invalid jwt
        let boatArr = [];
        const boats = get_public_boats(req).then((boats) => {
            if (boats !== undefined && boats.length !== undefined) {
                boats.forEach((element) => {
                    if (element.public == true) {
                        boatArr.push(element);
                    }
                });
                res.status(200).send(JSON.stringify(boatArr));
            } else {
                res.status(200).send(
                    JSON.stringify(
                        "No public boats are available, try again later"
                    )
                );
            }
        });
    });

router
    .patch("/:boat_id", checkJwt, function (req, res) {
        console.log("hello here");
        const accepts = req.accepts(["application/json"]);
        console.log("accept variable " + accepts);
        if (req.get("content-type") !== "application/json") {
            res.status(415).send("Server only accepts application/json data.");
        } else if (!accepts) {
            console.log("returning this");
            res.status(406).send("Not Acceptable");
        } else if (req.body === undefined || isEmpty(req.body)) {
            res.status(400).send(
                JSON.stringify("No boat attributes are being modified")
            );
        } else {
            patch_boat(
                req.params.boat_id,
                req.body.name,
                req.body.type,
                req.body.length,
                req.body.public,
                req.user.sub
            ).then((ourBoat) => {
                console.log('here is the patch request return ' + JSON.stringify(ourBoat));
                if (ourBoat == -1) {
                    res.status(404).json({
                        Error: "The boat does not exist",
                    });
                }else if(ourBoat == -22){
                    res.status(403).json({Error: "Only the owner can modify boats created by them"})
                } else if (ourBoat == -7) {
                    res.status(403).json({
                        Error: "A boat with that name already exists",
                    });
                } else if (req.body.id != undefined) {
                    res.status(403).send("The Id cannot be changed");
                } else {
                    res.location(
                        req.protocol +
                            "://" +
                            req.get("host") +
                            req.baseUrl +
                            "/" +
                            req.body.id
                    );
                    //console.log("HERE IS BODY: " + JSON.stringify(req.params));
                    const tempObject = {
                        id: req.params.id,
                        name: req.body.name,
                        type: req.body.type,
                        length: req.body.length,
                        public: req.body.public,
                        owner: ourBoat.owner,
                    };
                    res.status(200).send(tempObject);
                }
            });
        }
    })
    .use((err, req, res, next) => {
        //invalid jwt
        res.status(401).send(JSON.stringify("Invalid JWT"));
    });

    router.get("/:id", function (req, res) {
        const accepts = req.accepts(["application/json"]);
        if (!accepts) {
            res.status(406).send("Not Acceptable");
        }else{
        get_boat(req.params.id).then((boat) => {
            if (boat[0] === undefined || boat[0] === null) {
                res.status(404).json({ Error: "No boat with this boat_id exists" });
            } else {
                //boat
                boat[0]["self"] =
                    req.protocol + "://" + req.get("host") + req.originalUrl;
                if (boat[0].loads != null) {
                    let loadsSize = boat[0].loads;
                    if (loadsSize.length > 0) {
                        boat[0].loads.forEach((eachload) => {
                            eachload["self"] =
                                req.protocol +
                                "://" +
                                req.get("host") +
                                "/loads/" +
                                eachload.id;
                        });
                    } else {
                        delete boat[0].loads;
                    }
                }
    
                const myJSON = JSON.stringify(boat[0], null, 3);
                res.status(200).send(myJSON);
            }
        });
    }
    });

module.exports = router;
