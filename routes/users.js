var express = require("express");
const passport = require("passport");
var secured = require("../lib/middleware/secured");
var router = express.Router();

const { Datastore } = require("@google-cloud/datastore");
const projectId = "fp-alamgirj";
const datastore = new Datastore({ projectId: projectId });

const BOAT = "Boats";
const USER = "Users";

function fromDatastore(item) {
    item.id = item[Datastore.KEY].id;
    return item;
}

function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

function get_boats() {
    const q = datastore.createQuery(BOAT);
    return datastore.runQuery(q).then((entities) => {
        // Use Array.map to call the function fromDatastore. This function
        // adds id attribute to every element in the array at element 0 of
        // the variable entities
        return entities[0].map(fromDatastore);
    });
}

function get_users() {
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then((entities) => {
        // Use Array.map to call the function fromDatastore. This function
        // adds id attribute to every element in the array at element 0 of
        // the variable entities
        return entities[0].map(fromDatastore);
    });
}

async function saveUser(FullName, user_id, email) {

    var user_same_exists = 0;
    const allUsers = await get_users();
    if (!isEmpty(allUsers)){
      allUsers.forEach(element => {
        if (element.user_id === user_id && element.email === email){
          user_same_exists = 1;
        }
      });
    }
    if (user_same_exists === 0){
      var key = datastore.key(USER);
      const new_user = { FullName: FullName,
                    user_id: user_id,
                    email: email,
                };
                      return datastore
                    .save({ key: key, data: new_user })
                    .then(() => {
                        return key;
                    });         
    }
    }
/* GET user profile. */
router.get("/user", secured(), function (req, res, next) {
    const { _raw, _json, ...userProfile } = req.user;
    var sessionJWT = passport.session.JWT;
    userProfile["jWT TOKEN "] = sessionJWT;
    //console.log("Here is our user" + JSON.stringify(userProfile));
    saveUser(
        userProfile.displayName,
        userProfile.user_id,
        userProfile.emails[0].value
    );
    //console.log('here is the userProfile ' + JSON.stringify( _json));
    res.render("user", {
        userProfile: JSON.stringify(userProfile, null, 2),
        title: "Profile page",
    });
});

router.get("/users", function(req, res){
  var allUsers = get_users().then((varHolder)=>{
    res.status(200).send(JSON.stringify(varHolder));
  });
})

router.all('/users/:userId', (req,res) => { res.status(405), 
    res.status(405).json({'message': req.method + ' not allowed on this route'}) });


// router.get("/owner/:owner_id/boats", function (req, res) {
//     //console.log("Here is the request: " + JSON.stringify(res.body.owner));
//     let boatArr = [];
//     const boats = get_boats().then((tempVar) => {
//         console.log("here are the boats " + tempVar);
//         // res.status(200).send(tempVar);
//         // if(req.body.public == true && req.body.owner == ){
//         // console.log('here is the owern id ' + req.params.owner_id);
//         // }
//         var ownerId = req.params.owner_id;
//         if (tempVar !== undefined && tempVar.length !== undefined) {
//             console.log("here is owner ID: " + ownerId);
//             console.log("here is owner ID qwe wqe: " + JSON.stringify(tempVar[0]));
//             tempVar.forEach((element) => {
//                 if (element.owner === ownerId && element.public == true) {
//                     // console.log('your if sucks')
//                     boatArr.push(element);
//                     //console.log("hetre is array " + boatArr);
//                 }
//             });
//         }
//         // console.log("Here is the body: " + req);
//         res.status(200).send(JSON.stringify(boatArr, null, 2));
//     });
// });




module.exports = router;
