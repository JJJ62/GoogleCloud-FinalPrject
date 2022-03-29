var router = require("express").Router();
const LOADS = "loads";
const BOATS = "Boats";
const projectId = "fp-alamgirj";
const { Datastore } = require("@google-cloud/datastore");
const datastore = new Datastore({ projectId: projectId });
const ds = require("./datastore");
const bodyParser = require("body-parser");
const checkJwt = require("../lib/middleware/checkJwt");
router.use(bodyParser.json());

function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}

function isEmptyObject(obj) {
    var name;
    for (name in obj) {
      if (obj.hasOwnProperty(name)) {
        return false;
      }
    }
    return true;
  }
  
async function delete_load(loadId) {
    const loadKey = datastore.key([LOADS, parseInt(loadId, 10)]);
    const ourLoad = await get_load(loadId);
    var tempBId;
    if (ourLoad[0] === undefined || loadKey === undefined) {
        console.log('undefined');
        return -2;
    } else {
        var emptyLoad = 0;
        if (
            ourLoad[0].carrier !== undefined &&
            !isEmptyObject(ourLoad[0].carrier)
        ) {
            console.log("load is not empty delete boat from it");
            nuke_load_boat(ourLoad[0].carrier[0].id, loadId).then(
                (variableHolder) => {
                    console.log("boat has revised the load");
                }
            );
            emptyLoad = 1;
        } else {
            emptyLoad = 1;
        }
        if (emptyLoad == 1) {
            return datastore.delete(loadKey);
        }
    }
}

function get_boat(id) {
    const key = datastore.key([BOATS, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(fromDatastore);
        }
    });
}

async function nuke_load_boat(boatId, loadId) {
    const key = datastore.key([BOATS, parseInt(boatId, 10)]);
    var ourBoat = await get_boat(boatId);
    var sliceVar = 0;
    var countVar = 0;
    ourBoat[0].loads.forEach((element) => {
        if (element.id === loadId) {
            sliceVar = countVar;
        }
        countVar++;
    });
    ourBoat[0].loads.splice(sliceVar, 1);
    return datastore.save({ key: key, data: ourBoat[0] });
}

function get_loads(req) {
    var q = datastore.createQuery(LOADS).limit(5);
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

async function delete_load_from_boat(boatId, loadId) {
    var notExisting = false;
    var invalidBoatId = true;
    var invalidLoadId = true;
    const loadKey = datastore.key([LOADS, parseInt(loadId, 10)]);
    const boatKey = datastore.key([BOATS, parseInt(boatId, 10)]);
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
                    if (load[0].carrier.id == boatId) {
                        invalidLoadId = false;
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

/*
BOAT FUNCTIONS
*/
function get_boat(id) {
    const key = datastore.key([BOATS, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(fromDatastore);
        }
    });
}

function post_load(volume, content, creation_date, userSub) {
    var key = datastore.key(LOADS);
    const new_load = {
        volume: volume,
        content: content,
        creation_date: creation_date,
        owner_id: userSub
    };
    return datastore.save({ key: key, data: new_load }).then(() => {
        return key;
    });
}

function get_load(id) {
    const key = datastore.key([LOADS, parseInt(id, 10)]);
    return datastore.get(key).then((entity) => {
        if (entity[0] === undefined || entity[0] === null) {
            return entity;
        } else {
            return entity.map(fromDatastore);
        }
    });
}

async function patch_load(id, volume, content, creation_date, userSub) {
    var key = datastore.key([LOADS, parseInt(id, 10)]);
    // const existingBoat = await datastore.get(key).then((boat) => {
    //     if (boat == undefined || boat == false) {
    //         return -1;
    //     }
    //     return boat;
    // });
    const existingLoad = await get_load(id);
    if (existingLoad == false || existingLoad === -1) {
        return -1;
    } else if(existingLoad[0].owner_id != userSub){
        return -22 //not the correct owner to update
    } else {
        const updatedLoad = {
            volume: existingLoad[0].volume,
            content: existingLoad[0].content,
            creation_date: existingLoad[0].creation_date,
            id: existingLoad[0].id,
            owner_id: existingLoad[0].owner_id,
        };
        if (existingLoad[0].carrier !== undefined && !isEmptyObject(existingLoad[0].carrier)){
            // console.log('not empty');
            // loadIsBooked = true;
            updatedLoad["carrier"] = existingLoad[0].carrier;
        }
        if (volume !== undefined && volume !== "") {
            updatedLoad["volume"] = volume;
        }
        if (content !== undefined && content !== "") {
            updatedLoad["content"] = content;
        }
        if (creation_date !== undefined && creation_date !== "") {
            updatedLoad["creation_date"] = creation_date;
        }
        const new_entity = {
            key: key,
            data: updatedLoad,
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

async function put_load(id, volume, content, creation_date, userSub) {
    var key = datastore.key([LOADS, parseInt(id, 10)]);
    // const existingLoad = await datastore.get(key).then((load) => {
    //     if (load == undefined || load == false) {
    //         return -1;
    //     }
    //     return load;
    // });
    const existingLoad = await get_load(id);
    console.log('Here is the existing load' + JSON.stringify(existingLoad));
    if (existingLoad == false || existingLoad === -1) {
        return -1; // boat doesn't exist with that id
    }
    if (volume == "" || content == "" || creation_date == "" || 
    volume == undefined || content == undefined || creation_date == undefined) {
        return -6; //one of the values does not exist
    }
    console.log("Here is our usersub: " + userSub);
    console.log("Here is our existing owner: " + existingLoad[0].owner_id);
    console.log("Here is our existingLoad: " + JSON.stringify(existingLoad[0]));
    if(existingLoad[0].owner_id != userSub){
        return -12 //not the correct owner to update
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
    var updatedLoad = {
        volume: volume,
        content: content,
        creation_date: creation_date,
        owner_id: existingLoad[0].owner_id,
        id: existingLoad[0].id,
    };
    if (existingLoad[0].carrier !== undefined && !isEmptyObject(existingLoad[0].carrier)){
        // console.log('not empty');
        // loadIsBooked = true;
        updatedLoad["carrier"] = existingLoad[0].carrier;
    }
    
    const update_load = {
        key: key,
        data: updatedLoad
    }
    // return datastore.save({ key: key, data: updatedBoat });
    return datastore.update(update_load).then(() => {
        return update_load.data
    }).catch(() => {
        return false;
    })
}

router.put("/:id", checkJwt, function (req, res) {
    console.log("this req is coming in ");
    const accepts = req.accepts(["application/json"]);
   
     if (req.get("content-type") !== "application/json") {
        res.status(415).send("Server only accepts application/json data.");
    }
   else if (!accepts) {
        res.status(406).send("Not Acceptable");
    }
    else if (req.body.volume == "" || req.body.content == "" || req.body.creation_date== "" ||
    req.body.volume == undefined || req.body.content == undefined || req.body.creation_date == undefined
    ) {
        res.status(400).json({
            Error: "Not all attributes of the boat are being updated",
        });
    }else if(req.body.id != undefined){
        res.status(403).send("The Id cannot be changed");
    }
    else {

    put_load(req.params.id, req.body.volume, req.body.content, req.body.creation_date, req.user.sub).then(
        (myvar) => {
            console.log("My var is: " + myvar);
            if (myvar == -1) {
                res.status(404).json({
                    Error: "No load with that ID",
                });
            } else if (myvar == -6) {
                res.status(400).json({
                    Error: "Volume, content or creation_date is empty",
                });
            } else if (myvar == -8) {
                res.status(400).json({
                    Error: "Volume, content or creation_date is not a valid input type",
                });
            // } else if (myvar == -7) {
            //     res.status(403).json({
            //         Error: "A boat with that name already exists",
            //     });
            } else if (myvar == -9) {
                res.status(400).json({
                    Error: "not all attributes are being modified",
                });
            } else if(myvar == -12){
                res.status(403).json({
                    Error: "You do not have ownership of this load",
                });
            }else {
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
    console.log('the req is here');
    const accepts = req.accepts(["application/json"]);
    if (!accepts) {
        res.status(406).send("Not Acceptable");
    } else if (req.get("content-type") !== "application/json") {
        res.status(415).send("Server only accepts application/json data.");
    }
    else if (
        req.body.volume === undefined ||
        req.body.content === undefined ||
        req.body.creation_date === undefined
    ) {
        res.status(400).json({
            Error: "The request object is missing at least one of the required attributes",
        });
    } else {
        post_load(
            req.body.volume,
            req.body.content,
            req.body.creation_date,
            req.user.sub
        ).then((key) => {
            var urlSet =
                req.protocol +
                "://" +
                req.get("host") +
                req.originalUrl +
                "/" +
                key.id;
            const load_obj = {
                id: key.id,
                volume: req.body.volume,
                content: req.body.content,
                owner_id: req.body.sub,
                creation_date: req.body.creation_date,
                self: urlSet,
            };
            const myJSON = JSON.stringify(load_obj, null, 2);
            res.status(201).send(myJSON);
        });
    }
})    .use((err, req, res, next) => {
    res.status(401).send(JSON.stringify("Missing or invalid JWT"));
});

router.get("/:loadId", function (req, res) {
    const accepts = req.accepts(["application/json"]);
    if (!accepts) {
            res.status(406).send("Not Acceptable");
    }
    else{
        get_load(req.params.loadId).then((load) => {
            if (load[0] === undefined || load[0] === null) {
                res.status(404).json({ Error: "No load with this load_id exists" });
            } else {
                if (load[0].carrier != null) {
                    let arrayCarrier = load[0].carrier;
                    if (arrayCarrier.length > 0) {
                        console.log(
                            "here you go " + JSON.stringify(load[0].carrier)
                        );
                        load[0].carrier.forEach((eachShip) => {
                            eachShip["self"] =
                                req.protocol +
                                "://" +
                                req.get("host") +
                                "/boats/" +
                                eachShip.id;
                        });
                    } else {
                        delete load[0].carrier;
                    }
                }
                load[0]["self"] =
                    req.protocol + "://" + req.get("host") + req.originalUrl;
                const myJSON = JSON.stringify(load[0], null, 2);
                res.status(200).send(myJSON);
            }
        });
    }
});

router.get("/", function (req, res) {
    const accepts = req.accepts(["application/json"]);
    if (!accepts) {
            res.status(406).send("Not Acceptable");
    }
    else{
    const allLoads = get_loads(req).then((response) => { 
        response.items.forEach(element => {
            console.log('here is the carrer' + element.carrier);
            if (element.carrier !== undefined){
                element.carrier.forEach(child => {
                    child["self"] =          req.protocol +
                    "://" +
                    req.get("host") +
                    "/boats/" + child.id;
                });
            }
            element["self"] = req.protocol + "://" + req.get("host") + "/loads/" + element.id;
        });
        res.status(200).json(response);
    });
    }
});

// router.get('/', function(req, res) {
//     res.send('I am here you son of a boatc');
// })



router.delete("/:loadId", function (req, res) {
    delete_load(req.params.loadId).then  ((temp)=> {
        if (temp == undefined || temp == -2) {
            res.status(404).json({
                Error: "No load with this specific ID exists",
            });
        } else {
            res.status(204).send();
        }
    })

});

router
    .patch("/:load_id", checkJwt, function (req, res) {
        //console.log("hello here");
        //console.log("HERE IS BODY: " + JSON.stringify(req.body));
        const accepts = req.accepts(["application/json"]);
        //console.log("accept variable " + accepts);
        if (req.get("content-type") !== "application/json") {
            res.status(415).send("Server only accepts application/json data.");
        } else if (!accepts) {
            //console.log("returning this");
            res.status(406).send("Not Acceptable");
        } else if (req.body === undefined || isEmptyObject(req.body)) {
            res.status(400).send(
                JSON.stringify("No load attributes are being modified")
            );
        }
        else {
            // res.status(200).send("working on t");
            patch_load(
                req.params.load_id,
                req.body.volume,
                req.body.content,
                req.body.creation_date,
                req.user.sub
            ).then((ourLoad) => {
                console.log('here is our var' + ourLoad);
                if (ourLoad == -1) {
                    res.status(404).json({
                        Error: "The load does not exist",
                    });
                } else if(ourLoad == -22){
                    res.status(403).json({Error: "Only the owner can modify loads"});
                }
                else if (ourLoad == -7) {
                    res.status(403).json({
                        Error: "A load with that name already exists",
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
                        volume: req.body.volume,
                        content: req.body.content,
                        creation_date: req.body.creation_date,
                        public: req.body.public,
                        owner_id: ourLoad.owner_id,
                    };
                    res.status(200).send(tempObject);
                }
            });
        }
    })
    .use((err, req, res, next) => {
        //invalid jwt
        console.log("Error is here: " + JSON.stringify(err));
        res.status(401).send(JSON.stringify("Invalid JWT"));
    });


module.exports = router;
