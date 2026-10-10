export const EMPTY_COMPLETED_TEMPLATE_SAMPLE = Object.freeze({
  child_name:"",child_last_name:"",child_first_name:"",birth_date:"",parent1_name:"",parent2_name:"",
  parents_intro_enabled:false,parent1_photo_url:"",parent1_intro:"",parent2_photo_url:"",parent2_intro:"",
  parent1_phone:"",parent2_phone:"",person1_phone:"",host_phone:"",manager_phone:"",host1_phone:"",host2_phone:"",host_name:"",manager_name:"",host1_name:"",host2_name:"",person1_name:"",event_title:"",
  groom_name:"",groom_last_name:"",groom_first_name:"",bride_name:"",bride_last_name:"",bride_first_name:"",
  groom_phone:"",bride_phone:"",groom_father_name:"",groom_mother_name:"",bride_father_name:"",bride_mother_name:"",
  groom_father_phone:"",groom_mother_phone:"",bride_father_phone:"",bride_mother_phone:"",
  event_date:"",event_time:"",venue:"",venue_address:"",venue_building:"",venue_detail:"",
  transport_public_enabled:false,transport_public:"",transport_car_enabled:false,transport_car:"",
  transport_parking_enabled:false,transport_parking:"",
  groom_bank:"",groom_account:"",groom_account_holder:"",bride_bank:"",bride_account:"",bride_account_holder:"",
  invitation_message:"",gallery_images:[],timeline_enabled:false,timeline_items:[],
  rsvp_enabled:true,guestbook_enabled:true,
  notice_enabled:false,notice_title:"",notice_body:"",notice_image_url:""
});

export const completedTemplateCategoryToEventKind = category =>
  category === "first-birthday" ? "first_birthday" : (category || "wedding");

export function sampleContentToInvitation(sampleContent, category, extra = {}) {
  const sc = {...EMPTY_COMPLETED_TEMPLATE_SAMPLE,...(sampleContent || {})};
  const eventKind = completedTemplateCategoryToEventKind(category);
  const common = {
    eventKind,date:sc.event_date,time:sc.event_time,venue:sc.venue,venueAddress:sc.venue_address,
    venueBuilding:sc.venue_building,venueDetail:sc.venue_detail,message:sc.invitation_message,
    galleryImages:Array.isArray(sc.gallery_images)?sc.gallery_images:[],
    parentsIntroEnabled:sc.parents_intro_enabled===true,parent1PhotoUrl:sc.parent1_photo_url,parent1Intro:sc.parent1_intro,
    parent2PhotoUrl:sc.parent2_photo_url,parent2Intro:sc.parent2_intro,
    timelineEnabled:sc.timeline_enabled===true,timelineItems:Array.isArray(sc.timeline_items)?sc.timeline_items:[],
    parent1Phone:sc.parent1_phone,parent2Phone:sc.parent2_phone,person1Phone:sc.person1_phone,hostPhone:sc.host_phone,hostName:sc.host_name,managerPhone:sc.manager_phone,managerName:sc.manager_name,host1Phone:sc.host1_phone,host1Name:sc.host1_name,host2Phone:sc.host2_phone,host2Name:sc.host2_name,
    groomPhone:sc.groom_phone,bridePhone:sc.bride_phone,groomFatherPhone:sc.groom_father_phone,
    groomMotherPhone:sc.groom_mother_phone,brideFatherPhone:sc.bride_father_phone,brideMotherPhone:sc.bride_mother_phone,
    transportGuideEnabled:sc.transport_public_enabled===true||sc.transport_car_enabled===true||sc.transport_parking_enabled===true,
    transportPublicEnabled:sc.transport_public_enabled===true,transportPublic:sc.transport_public,
    transportCarEnabled:sc.transport_car_enabled===true,transportCar:sc.transport_car,
    transportParkingEnabled:sc.transport_parking_enabled===true,transportParking:sc.transport_parking,
    groomBank:sc.groom_bank,groomAccount:sc.groom_account,groomAccountHolder:sc.groom_account_holder,
    brideBank:sc.bride_bank,brideAccount:sc.bride_account,brideAccountHolder:sc.bride_account_holder,
    rsvpEnabled:sc.rsvp_enabled!==false,guestbookEnabled:sc.guestbook_enabled!==false,
    notice:{enabled:sc.notice_enabled===true,title:sc.notice_title,body:sc.notice_body,imagePath:sc.notice_image_url,version:0},
    ...extra
  };
  if(eventKind==="birthday") return {...common,
    person1Name:sc.person1_name||sc.child_first_name||sc.child_name||"",
    person1FirstName:sc.person1_first_name||sc.child_first_name||"",
    eventTitle:sc.event_title||""
  };
  if(eventKind==="first_birthday") return {...common,
    childName:sc.child_name||[sc.child_last_name,sc.child_first_name].join(""),childNameLastName:sc.child_last_name,
    childNameFirstName:sc.child_first_name,birthDate:sc.birth_date,parent1Name:sc.parent1_name,parent2Name:sc.parent2_name
  };
  if(["milestone_birthday","gathering","opening"].includes(eventKind)) return {...common,
    eventTitle:sc.event_title||"",person1Name:sc.person1_name||"",hostName:sc.host_name||""
  };
  return {...common,
    groom:sc.groom_name||[sc.groom_last_name,sc.groom_first_name].join(""),groomLastName:sc.groom_last_name,groomFirstName:sc.groom_first_name,
    bride:sc.bride_name||[sc.bride_last_name,sc.bride_first_name].join(""),brideLastName:sc.bride_last_name,brideFirstName:sc.bride_first_name,
    groomFatherName:sc.groom_father_name,groomMotherName:sc.groom_mother_name,brideFatherName:sc.bride_father_name,brideMotherName:sc.bride_mother_name
  };
}
