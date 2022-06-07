turnConfig = {
    iceServers: [
    {   
      urls: [ "stun:stun.netsend.pw" ]
    }, 
    {   
      username: "ejikerichard",   
      credential: "Ejikerichard234@",   
      urls: [       
        "turn:stun.netsend.pw:3478?transport=udp",       
        "turn:stun.netsend.pw:3478?transport=tcp",       
       ]
     }
   ]
}